const express = require("express");
const bcrypt = require('bcrypt')
const path = require("path");
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5100;
const mongoose = require('mongoose');
const { MONGO_URI } = require('./db/connect');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const models = require("./models/schema");

// app.use(bodyParser.json());
app.use(cors());

// admin middelware
function adminAuthenticateToken(req, res, next) {
    console.log("Hello")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).send('Unauthorized');
    jwt.verify(token, 'ADMIN_SECRET_TOKEN', (err, user) => {
      if (err) return res.status(403).send('Forbidden');
      req.user = user;
      next();
    });
  }
  


// user middleware
const userAuthenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader.split(" ")[1]
        console.log(authHeader)
        if (!token) {
            res.status(401);
            return res.send('Invalid JWT Token');
        }
        const decoded = jwt.verify(token, 'USER_SECRET_TOKEN')
        req.user = decoded.user;
        next();

    } catch (err) {
        console.error(err);
        res.status(500);
        res.send('Server Error');
    }
};



// Add a new category to the database
// API endpoint to add a category
app.post('/api/admin/add-category', adminAuthenticateToken, async (req, res) => {
    try {
        const { category, description } = req.body;
        console.log(category)

        // Validate inputs
        if (!category) {
            return res.status(400).send('Category and description are required');
        }

        // Check if category already exists
        const existingCategory = await models.Category.findOne({ category });
        if (existingCategory) {
            return res.status(400).send('Category already exists');
        }

        // Create a new category object
        const newCategory = new models.Category({
            category,
            description
        });

        // Save the new category to the database
        const savedCategory = await newCategory.save();
        console.log(savedCategory, 'category created');
        
        // Return success response
        return res.status(200).send(savedCategory);
    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
});

  
  

app.delete('/api/admin/delete-all-categories', async (req, res) => {
    try {
      await models.Category.deleteMany({});
      res.status(200).json({ message: 'All categories deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  });


app.get('/api/categories', async (req, res) => {
    try {
        const cotegoriesList = await models.Category.find();
        res.status(200).send(cotegoriesList);
    } catch (error) {
        res.status(500).send('Server error');
        console.log(error);
    }
})



// Add a new product to the database and associate it with an existing category
app.post('/api/admin/add-product', adminAuthenticateToken, async (req, res) => {
    try {
        const { productname, description, price, brand, image, category, countInStock, rating, quantity } = req.body;
        console.log(req.body);
        if (!productname || !description || !price || !brand || !image || !category || !countInStock || !rating ) {
            return res.status(400).send({ message: 'Missing required fields' });
        }
        const foundCategory = await models.Category.findOne({ category });
        if (!foundCategory) {
            return res.status(404).send({ message: 'Category not found' });
        }
        const product = new models.Product({
            productname,
            description,
            price,
            brand,
            image,
            category,
            countInStock,
            rating,
            quantity,
            dateCreated: new Date()
        });

        await product.save();

        res.status(201).send(product);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Internal server error' });
    }
});


// Endpoint for adding an item to the cart
app.post('/api/add-to-cart', userAuthenticateToken, async (req, res) => {
    const { productId, quantity } = req.body;

    // Validate the input data against the schema
    const item = new models.AddToCart({ productId, quantity });
    const validationError = item.validateSync();

    if (validationError) {
        return res.status(400).send(validationError.message);
    }

    try {
        // Save the new cart item to the database
        await item.save();
        res.send(`Added ${quantity} of product ${productId} to cart`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.delete('/api/delete-from-cart/:id', async (req, res) => {
    try {
        const deletedItem = await models.AddToCart.findByIdAndDelete(req.params.id);
        if (!deletedItem) {
            return res.status(404).send('Item not found');
        }
        res.send(`Deleted item ${itemId} from cart`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.delete('/api/delete-cart-items', async (req, res) => {
    try {
      await models.AddToCart.deleteMany({});
      res.send('All cart items deleted');
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal server error');
    }
  });
  


app.get('/api/cart-items', async (req, res) => {
    try {
        const cartItems = await models.AddToCart.find();
        const productIds = cartItems.map(item => item.productId);
        const products = await models.Product.find({ _id: { $in: productIds } });
        res.send(products);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});


// Create a new order
app.post('/api/admin/order', async (req, res) => {
    const order = new models.Order({
      user: req.body.user,
      phone:req.body.phone,
      productId: req.body.productId,
      address1: req.body.address1,
      address2: req.body.address2
    });
  
    try {
      const newOrder = await order.save();
      res.status(201).json(newOrder);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });


  app.get('/api/admin/orders', async (req, res) => {
    try {
      const order = await models.Order.find();
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      res.json(order);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  


// Manage order (admin only)
app.put('/api/admin/order/:id', adminAuthenticateToken, async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await models.Order.findById(orderId);
        if (!order) {
            return res.status(404).send('Order not found');
        }
        Object.keys(req.body).forEach(key => {
            order[key] = req.body[key];
        });

        const updatedOrder = await order.save();
        res.send(updatedOrder);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});



// Manage payment (admin only)
// Define the route for updating a payment
app.post('/api/admin/payment/:id', adminAuthenticateToken, async (req, res) => {
    try {
        const paymentId = req.params.id;
        const payment = await models.Payment.findById(paymentId);
        if (!payment) {
            return res.status(404).send('Payment not found');
        }
        const { amount, status } = req.body;
        if (!amount || !status) {
            return res.status(400).json({ message: 'Both amount and status are required' });
        }
        const updatedPayment = await models.Payment.findByIdAndUpdate(
            paymentId,
            { amount, status },
            { new: true, runValidators: true }
        );
        res.status(200).json({
            message: 'Payment updated successfully',
            payment: updatedPayment,
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid payment ID' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        console.error(error);
        res.status(500).send('Server error');
    }
});



// // feedback schema

// Create feedback from user
app.post('/api/user/feedback', userAuthenticateToken, async (req, res) => {
    try {
        const { user, message } = req.body;
        const feedback = new models.Feedback({ user, message });
        const savedFeedback = await feedback.save();
        res.status(201).json(savedFeedback);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Check feedback (admin only)
app.get('/api/admin/feedback', adminAuthenticateToken, async (req, res) => {
    try {
        const feedback = await models.Feedback.find();
        res.status(200).send(feedback);
    } catch (error) {
        res.status(500).send('Server error');
        console.log(error);
    }
});


// admin register schema
app.post('/api/admin/register', async (request, response) => {
    try {
        const { username, password } = request.body;
        const adminExists = await models.Admin.findOne({ username });

        if (adminExists) {
            response.status(409).send("Admin already exists");
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const admin = new models.Admin({ username, password: hashedPassword });
            await admin.save();
            response.status(201).send('Admin registration successful');
        }
    } catch (error) {
        response.status(500).send('Server error');
        console.log(error);
    }
});


// // admin schema

const saltRounds = 10;

app.post('/api/admin/login', async (request, response) => {
    try {
        const { username, password } = request.body;
        const admin = await models.Admin.findOne({ username });
        console.log(username)

        if (!admin) {
            response.status(404).send("Admin not found");
        } else {
            const isMatch = await bcrypt.compare(password, admin.password);
            if (isMatch) {
                const payload = {
                    username: username,
                };
                const jwtToken = jwt.sign(payload, "ADMIN_SECRET_TOKEN");
                response.send({ jwtToken });
            } else {
                response.status(401).send('Invalid password');
            }
        }
    } catch (error) {
        response.status(500).send('Server error');
        console.log(error);
    }
});



// user schema
app.post('/api/user/register', async (req, res) => {
    try {
        const { firstname, lastname, username, email, password } = req.body;

        // Check if email already exists
        const user = await models.Users.findOne({ email });
        if (user) {
            return res.status(400).send('User already exists');
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create a new user object
        const newUser = new models.Users({
            firstname,
            lastname,
            username,
            email,
            password: hashedPassword,
        });

        // Save the new user to the database
        const userCreated = await newUser.save();
        console.log(userCreated, 'user created');
        res.status(200).send('Successfully Registered');
    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
});






// user login schema

app.post('/api/user/login', async (request, response) => {
    try {
        const { email, password } = request.body;
        const user = await models.Users.findOne({ email });

        if (!user) {
            response.status(404).send("User not found");
        } else {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                const payload = {
                    email: email,
                };
                const jwtToken = jwt.sign(payload, "USER_SECRET_TOKEN");
                response.send({ jwtToken });
            } else {
                response.status(401).send('Invalid password');
            }
        }
    } catch (error) {
        response.status(500).send('Server error');
        console.log(error);
    }
});


// get users

app.get('/api/users', async (req, res) => {
    try {
        const users = await models.Users.find();
        res.send(users);
    } catch (error) {
        res.status(500).send('Server error');
        console.log(error);
    }
});


app.delete('/api/user/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deletedUser = await models.Users.findById({ id });
        if (deletedUser) {
            res.send(`User ${username} deleted`);
        } else {
            res.status(404).send(`User ${username} not found`);
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Server error');
    }
});


// app.delete('/delete/api/users',adminAuthenticateToken, async (req, res) => {
//     try {
//         await models.Category.deleteMany();
//         res.status(200).json({ message: 'All users deleted successfully' });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Server Error' });
//     }
// });


// Get Products

// Define a function to query the database for all products
const getAllProducts = async () => {
    try {
        const products = await models.Product.find();
        return products;
    } catch (error) {
        console.log(error);
        return error;
    }
};

// Define a route for the "get products" API endpoint
app.get('/api/products', async (req, res) => {
    const products = await getAllProducts();
    res.json(products);
});


// Get a single product
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await models.Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error(`Error getting product with id ${req.params.id}`, error);
        res.status(500).json({ message: `Error getting product with id ${req.params.id}` });
    }
});

app.delete('/api/products/:id',adminAuthenticateToken, async (req, res) => {
    try {
        const deletedProduct = await models.Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted' });
    } catch (error) {
        console.error(`Error deleting product with id ${req.params.id}`, error);
        res.status(500).json({ message: `Error deleting product with id ${req.params.id}` });
    }
});

app.put('/api/products/:id', adminAuthenticateToken, async (req, res) => {
    try {
      const updatedProduct = await models.Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updatedProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.status(200).json(updatedProduct);
    } catch (error) {
      console.error(`Error updating product with id ${req.params.id}`, error);
      res.status(500).json({ message: `Error updating product with id ${req.params.id}` });
    }
  });
  


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});


module.exports = app;
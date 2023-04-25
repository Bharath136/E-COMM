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
const adminAuthenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader.split(" ")[1]
        if (!token) {
            res.status(401);
            return res.send('Invalid JWT Token');
        }
        const decoded = jwt.verify(token, 'ADMIN_SECRET_TOKEN')
        req.user = decoded.user;
        next();

    } catch (err) {
        console.error(err);
        res.status(500);
        res.send('Server Error');
    }
};

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
app.post('/api/admin/add-category', adminAuthenticateToken, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            res.status(400).send('Category name is required');
            return;
        }
        const newCategory = new models.Category({ name });
        await newCategory.save();
        res.status(200).send('Category added successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});


// Add a new product to the database and associate it with an existing category
app.post('/api/admin/add-product', async (req, res) => {
    try {
        // Validate request body
        const { name, description, price, brand, image, category, countInStock, rating } = req.body;
        if (!name || !description || !price || !brand || !image || !category || !countInStock || !rating) {
            return res.status(400).send({ message: 'Missing required fields' });
        }

        // Check if category exists
        const foundCategory = await models.Category.findOne({ name: category });
        console.log(foundCategory)
        if (!foundCategory) {
            return res.status(404).send({ message: 'Category not found' });
        }

        // Create a new product document and associate it with the category
        const product = new models.Product({
            name,
            description,
            price,
            brand,
            image,
            category: foundCategory._id, // associate the product with the found category
            countInStock,
            rating,
            dateCreated: new Date()
        });

        // Save the product document
        await product.save();

        // Send response with the created product document
        res.status(201).send(product);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Internal server error' });
    }
});


// manage order schema

// Manage order (admin only)
app.put('/api/admin/order/:id', adminAuthenticateToken, async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await models.Product.findById(orderId);
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
        const user = await models.Users.findOne({ email });

        if (user) {
            return res.status(400).send('User already exists');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new models.Users({
            firstname,
            lastname,
            username,
            email,
            password: hashedPassword,
        });

        const userCreated = await newUser.save();
        console.log(userCreated, 'user created');
        res.status(200).send('Successfully Registered');
    } catch (error) {
        res.status(500).send('Server Error');
        console.log(error);
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


app.delete('/api/user', async (req, res) => {
    const { username } = req.body;

    try {
        const deletedUser = await models.Users.findOneAndDelete({ username });
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


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

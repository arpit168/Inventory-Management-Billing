# Inventory Management System

A complete, enterprise-level Inventory Management System built with the MERN Stack (MongoDB, Express, React, Node.js) featuring product management, billing, inventory tracking, notifications, and user authentication.

## Features

### 🔐 Authentication System
- User registration with email verification
- Secure login with JWT
- Password reset functionality
- Profile management
- Password change capability

### 📦 Product Management
- Add, update, delete products
- SKU management
- Product categorization
- Stock level tracking
- Low stock alerts
- Product search and filtering

### 🏷️ Category Management
- Create and manage product categories
- Category statistics
- Product organization

### 📊 Inventory Management
- Stock In/Out tracking
- Stock adjustment
- Complete movement history
- Inventory analytics
- Low stock notifications

### 💳 Billing System
- Invoice creation
- Multi-product invoicing
- Automatic inventory deduction
- Payment tracking
- Invoice history
- Customer notifications

### 🔔 Notification System
- Real-time alerts
- Low stock notifications
- Invoice notifications
- Email alerts
- Notification history

### 📈 Dashboard
- Sales analytics
- Revenue trends
- Inventory overview
- Top-selling products
- Category statistics
- Business insights

### 📧 Email System
- Email verification
- Password reset emails
- Inventory alerts
- Invoice notifications
- Customer communications

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Nodemailer** - Email service
- **Express Validator** - Input validation
- **Helmet** - Security middleware
- **CORS** - Cross-origin handling
- **Morgan** - HTTP logging

### Frontend
- **React 19** - UI library
- **React Router** - Navigation
- **Axios** - HTTP client
- **Tailwind CSS** - Styling
- **React Hook Form** - Form management
- **React Hot Toast** - Notifications
- **Recharts** - Analytics charts
- **Lucide React** - Icons

## Project Structure

```
Inventory-System/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── productController.js
│   │   │   ├── categoryController.js
│   │   │   ├── inventoryController.js
│   │   │   ├── invoiceController.js
│   │   │   ├── notificationController.js
│   │   │   └── dashboardController.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Product.js
│   │   │   ├── Category.js
│   │   │   ├── Inventory.js
│   │   │   ├── Invoice.js
│   │   │   └── Notification.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── productRoutes.js
│   │   │   ├── categoryRoutes.js
│   │   │   ├── inventoryRoutes.js
│   │   │   ├── invoiceRoutes.js
│   │   │   ├── notificationRoutes.js
│   │   │   └── dashboardRoutes.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── services/
│   │   │   └── emailService.js
│   │   ├── validators/
│   │   │   └── validators.js
│   │   └── utils/
│   │       └── tokenUtils.js
│   ├── index.js
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── UI.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Products.jsx
│   │   │   ├── Invoices.jsx
│   │   │   └── Notifications.jsx
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── routes/
│   │   │   └── ProtectedRoute.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js
│   ├── .env
│   └── package.json
└── README.md
```

## Installation & Setup

### Prerequisites
- Node.js 16+ installed
- MongoDB Atlas account (or local MongoDB)
- npm or yarn package manager
- SMTP email service credentials

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the backend directory:
   ```env
   # MongoDB Configuration
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/inventory_db?retryWrites=true&w=majority

   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
   JWT_EXPIRE=7d

   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password
   EMAIL_FROM=noreply@inventorysystem.com

   # Token Expiration
   VERIFICATION_TOKEN_EXPIRE=24
   RESET_TOKEN_EXPIRE=30

   # Frontend URL
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start the backend server:**
   ```bash
   npm run dev
   ```

   The server will run on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory (in a new terminal):**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the frontend directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

## Usage

### First Run

1. **Create an account:**
   - Go to `http://localhost:5173/register`
   - Fill in the registration form
   - Check your email for verification link
   - Verify your email

2. **Login:**
   - Go to `http://localhost:5173/login`
   - Use your registered email and password

3. **Navigate the application:**
   - **Dashboard:** View business metrics and analytics
   - **Products:** Manage your product inventory
   - **Categories:** Organize products by categories
   - **Invoices:** Create and manage customer invoices
   - **Inventory:** Track stock movements
   - **Notifications:** View system alerts and notifications

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/verify-email/:token` - Email verification
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password/:token` - Password reset
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password

### Product Endpoints
- `GET /api/products` - Get all products (with pagination & filtering)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Add new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/low-stock` - Get low stock products
- `GET /api/products/out-of-stock` - Get out of stock products
- `GET /api/products/stats` - Get product statistics

### Inventory Endpoints
- `POST /api/inventory/stock-in` - Record stock in
- `POST /api/inventory/stock-out` - Record stock out
- `POST /api/inventory/adjustment` - Adjust stock
- `GET /api/inventory/history` - Get inventory history
- `GET /api/inventory/product/:id` - Get product inventory history
- `GET /api/inventory/stats` - Get inventory statistics

### Invoice Endpoints
- `POST /api/invoices` - Create invoice
- `GET /api/invoices` - Get all invoices
- `GET /api/invoices/:id` - Get single invoice
- `PUT /api/invoices/:id/status` - Update invoice status
- `DELETE /api/invoices/:id` - Cancel invoice
- `GET /api/invoices/stats` - Get billing statistics

### Notification Endpoints
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/mark-all-read` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification
- `DELETE /api/notifications` - Delete all notifications
- `GET /api/notifications/unread-count` - Get unread count

### Dashboard Endpoints
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/sales-chart` - Get sales data
- `GET /api/dashboard/revenue-chart` - Get revenue data
- `GET /api/dashboard/inventory-chart` - Get inventory distribution
- `GET /api/dashboard/top-products` - Get top selling products
- `GET /api/dashboard/category-stats` - Get category statistics

## Security Features

✅ **JWT Authentication** - Secure token-based authentication
✅ **Password Hashing** - bcryptjs for secure password storage
✅ **Protected Routes** - Authentication middleware on protected endpoints
✅ **Input Validation** - Express-validator for server-side validation
✅ **CORS Protection** - Cross-origin request handling
✅ **Helmet Middleware** - HTTP header security
✅ **Rate Limiting** - Prevent abuse and DoS attacks
✅ **MongoDB Injection Protection** - Mongoose schema validation
✅ **XSS Protection** - Input sanitization and validation

## Performance Optimizations

- Pagination for large datasets
- Database indexing on frequently queried fields
- Efficient queries with Mongoose population
- Client-side caching with localStorage
- Lazy loading of components
- Optimized images and assets
- CSS utility framework for smaller bundle size

## Email Configuration

### Gmail Setup (Recommended)
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the App Password in the EMAIL_PASSWORD environment variable

### Other SMTP Services
Update the email configuration in `.env`:
```env
EMAIL_HOST=your_smtp_host
EMAIL_PORT=587
EMAIL_USER=your_email
EMAIL_PASSWORD=your_password
```

## Troubleshooting

### "Connection refused" error
- Ensure MongoDB is running
- Check your MongoDB URI in .env

### "JWT token invalid" error
- Clear browser localStorage
- Log out and log back in
- Check JWT_SECRET in backend .env

### Email not sending
- Verify SMTP credentials
- Enable "Less secure apps" (if using Gmail)
- Check EMAIL_FROM address

### CORS errors
- Ensure FRONTEND_URL in backend .env matches your frontend URL
- Check browser console for specific CORS issues

## Future Enhancements

- [ ] Role-based access control (RBAC)
- [ ] Multi-currency support
- [ ] Advanced reporting and analytics
- [ ] Barcode scanning
- [ ] Mobile app
- [ ] API documentation with Swagger
- [ ] Audit logging
- [ ] Data export (CSV, Excel)
- [ ] Multi-warehouse support
- [ ] Supplier management

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, questions, or suggestions, please create an issue in the repository or contact the development team.

## Deployment

### Backend Deployment (Heroku, Railway, Render)
1. Set environment variables in your hosting platform
2. Ensure Node.js version is compatible
3. Deploy using platform-specific instructions

### Frontend Deployment (Vercel, Netlify)
1. Update VITE_API_URL to point to your backend URL
2. Build: `npm run build`
3. Deploy the `dist` folder

## Live Demo

[Demo URL will be available after deployment]

---

**Last Updated:** May 2026
**Version:** 1.0.0

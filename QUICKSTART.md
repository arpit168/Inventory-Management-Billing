# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Clone & Navigate
```bash
cd d:\Self\Inventory-System
```

### Step 2: Backend Setup
```bash
cd backend
npm install
```

**Create `.env` file in backend directory:**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/inventory_db?retryWrites=true&w=majority
PORT=5000
JWT_SECRET=your_secret_key_here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
FRONTEND_URL=http://localhost:5173
```

**Start Backend:**
```bash
npm run dev
```

### Step 3: Frontend Setup (New Terminal)
```bash
cd frontend
npm install
```

**Start Frontend:**
```bash
npm run dev
```

### Step 4: Access the Application
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/api/health

## 📝 Test Account

After you've set up MongoDB and email service, you can:

1. Register a new account at `/register`
2. Verify your email (check your email for verification link)
3. Login with your credentials
4. Start managing your inventory!

## 🔑 Default Admin Setup

To create an admin user, you can:
1. Register normally
2. Use the generated account as admin
3. Or modify the User model to set `role: 'admin'` during registration

## 🌐 API Testing with Postman

### Register
```
POST http://localhost:5000/api/auth/register
Body: {
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

### Login
```
POST http://localhost:5000/api/auth/login
Body: {
  "email": "john@example.com",
  "password": "password123"
}
```

### Add Product
```
POST http://localhost:5000/api/products
Headers: Authorization: Bearer [YOUR_TOKEN]
Body: {
  "name": "Product Name",
  "sku": "SKU001",
  "category": "[CATEGORY_ID]",
  "purchasePrice": 10,
  "sellingPrice": 20,
  "quantity": 100
}
```

## 🐛 Troubleshooting

### MongoDB Connection Error
- Verify MongoDB URI in .env
- Ensure your IP is whitelisted in MongoDB Atlas
- Check username/password

### Email Not Sending
- Use Gmail App Password (not your regular password)
- Enable "Less secure app access" (if not using App Password)
- Check EMAIL_USER and EMAIL_PASSWORD are correct

### CORS Error
- Ensure FRONTEND_URL matches your frontend URL
- Check backend .env FRONTEND_URL setting

### Port Already in Use
- Backend: `npm run dev -- --port 5001`
- Frontend: Vite will suggest a different port automatically

## 📱 Features Overview

✅ **User Management** - Register, login, profile update  
✅ **Product Inventory** - Add, edit, delete products  
✅ **Stock Tracking** - Monitor stock in/out movements  
✅ **Billing** - Create and manage invoices  
✅ **Notifications** - Real-time system alerts  
✅ **Analytics** - Dashboard with business insights  

## 🎨 Customization

### Change App Title
Edit `frontend/index.html` and update the `<title>` tag

### Change Colors
Edit `frontend/tailwind.config.js` to customize colors

### Change Backend Port
In `backend/.env`: `PORT=3000`

### Change API URL
In `frontend/.env`: `VITE_API_URL=http://localhost:3000/api`

## 📚 Next Steps

1. **Add More Pages:** Create new pages in `frontend/src/pages/`
2. **Add Categories:** Create categories in the UI
3. **Add Products:** Add products with prices and stock
4. **Test Invoicing:** Create test invoices
5. **Check Notifications:** View generated notifications

## 🚢 Production Deployment

### Build Frontend
```bash
cd frontend
npm run build
```

Deploy the `dist` folder to Vercel, Netlify, or your hosting provider.

### Deploy Backend
1. Push to GitHub
2. Connect to Heroku, Railway, or Render
3. Set environment variables in platform settings
4. Deploy!

## 💡 Tips

- Use dummy data to test features quickly
- Check browser console for API errors
- Check backend console for server errors
- Use Postman to test API endpoints
- Review email service configuration carefully

## ⚠️ Important Notes

- Change `JWT_SECRET` to a strong, random string in production
- Never commit `.env` files to Git
- Use environment variables for sensitive data
- Test email sending before going live
- Set up MongoDB backups for production

## 🆘 Need Help?

- Check the README.md for detailed documentation
- Review error messages in console (browser/terminal)
- Check backend logs for API errors
- Verify all .env variables are set correctly
- Ensure MongoDB Atlas is properly configured

---

**You're all set! Happy inventory managing! 🎉**

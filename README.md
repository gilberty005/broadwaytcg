# Pokemon Collectr 🎴

A comprehensive Pokemon card collection management app with price tracking capabilities, similar to Collectr. Track your Pokemon cards, monitor market prices, and manage your collection with ease.

## Features ✨

### Core Features
- **User Authentication** - Secure login/register system with JWT tokens
- **Card Management** - Manually add and manage Pokemon cards in your database
- **Collection Tracking** - Add cards to your personal collection with purchase details
- **Price Tracking** - Monitor current market prices from eBay and other sources
- **Price History** - Track price changes over time
- **Collection Statistics** - View detailed stats about your collection
- **Search & Filter** - Find cards by name, set, rarity, and more

### Advanced Features
- **Price Alerts** - Get notified of significant price changes
- **Investment Tracking** - Monitor your total investment and potential gains/losses
- **For Sale Management** - Mark cards as for sale with asking prices
- **Responsive Design** - Beautiful UI that works on desktop and mobile
- **Real-time Updates** - Live price fetching and collection updates

## Tech Stack 🛠️

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **JWT** authentication
- **bcryptjs** for password hashing
- **Axios** for HTTP requests
- **Cheerio** for web scraping

### Frontend
- **React 18** with functional components
- **React Router** for navigation
- **React Query** for data fetching
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Hook Form** for form management

## Prerequisites 📋

Before you begin, ensure you have the following installed:
- **Node.js** (v16 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**

## Installation & Setup 🚀

### 1. Clone the Repository
```bash
git clone <repository-url>
cd pokemon-collectr
```

### 2. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 3. Database Setup
1. Create a PostgreSQL database:
```sql
CREATE DATABASE pokemon_collectr;
```

2. Create a `.env` file in the root directory (copy from `env.example`):
```bash
cp env.example .env
```

3. Update the `.env` file with your database credentials:
```env
DB_USER=your_username
DB_HOST=localhost
DB_NAME=pokemon_collectr
DB_PASSWORD=your_password
DB_PORT=5432

JWT_SECRET=your_super_secret_jwt_key_here
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### 4. Start the Application

#### Development Mode
```bash
# Start both backend and frontend concurrently
npm run dev

# Or start them separately:
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
cd client && npm start
```

#### Production Mode
```bash
# Build the frontend
npm run build

# Start the production server
NODE_ENV=production npm run server
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## API Endpoints 📡

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Cards
- `GET /api/cards` - Get all cards (with pagination and search)
- `GET /api/cards/:id` - Get specific card
- `POST /api/cards` - Add new card (manual entry)
- `PUT /api/cards/:id` - Update card
- `DELETE /api/cards/:id` - Delete card
- `GET /api/cards/sets/list` - Get all card sets
- `GET /api/cards/rarities/list` - Get all card rarities

### Collections
- `GET /api/collections` - Get user's collection
- `POST /api/collections` - Add card to collection
- `PUT /api/collections/:id` - Update collection item
- `DELETE /api/collections/:id` - Remove card from collection
- `GET /api/collections/stats` - Get collection statistics
- `GET /api/collections/for-sale` - Get cards marked for sale

### Prices
- `GET /api/prices/card/:cardId` - Get current prices for a card
- `POST /api/prices/save` - Save price to database
- `GET /api/prices/history/:cardId` - Get price history
- `GET /api/prices/alerts` - Get price alerts for collection
- `POST /api/prices/bulk-update` - Bulk update prices

## Database Schema 🗄️

### Tables
- **users** - User accounts and authentication
- **cards** - Pokemon card information
- **collections** - User's personal card collection
- **price_history** - Historical price data
- **wishlist** - User's wishlist items

### Key Relationships
- Users can have multiple collection items
- Cards can be in multiple users' collections
- Price history is linked to specific cards
- Collections track purchase prices and quantities

## Usage Guide 📖

### Getting Started
1. **Register/Login** - Create an account or sign in
2. **Add Cards** - Manually add Pokemon cards to the database
3. **Build Collection** - Add cards to your personal collection
4. **Track Prices** - Monitor market prices and track changes
5. **View Statistics** - Analyze your collection performance

### Adding Cards
1. Navigate to "Add Card" from the navigation
2. Fill in card details (name, set, rarity, etc.)
3. Upload an image URL (optional)
4. Save the card to the database

### Managing Collection
1. Browse available cards in the "Cards" section
2. Click "Add to Collection" on desired cards
3. Enter purchase details (price, date, quantity)
4. View your collection in the "Collection" section

### Price Tracking
1. Cards with purchase prices automatically track market changes
2. View price alerts on the dashboard
3. Use the "Price Tracker" for detailed price analysis
4. Set up price monitoring for specific cards

## Customization 🎨

### Styling
The app uses Tailwind CSS for styling. You can customize:
- Colors in `client/tailwind.config.js`
- Component styles in `client/src/index.css`
- Individual component styling

### Price Sources
Currently supports:
- **eBay** - Web scraping of sold listings
- **TCGPlayer** - Placeholder (requires API access)

To add more price sources:
1. Update `server/routes/prices.js`
2. Add new price fetching functions
3. Update the frontend to display new sources

## Deployment 🌐

### Heroku Deployment
1. Create a Heroku app
2. Add PostgreSQL addon
3. Set environment variables
4. Deploy using:
```bash
git push heroku main
```

### Docker Deployment
1. Create a `Dockerfile`
2. Build and run the container
3. Set up PostgreSQL container
4. Configure environment variables

## Contributing 🤝

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License 📄

This project is licensed under the ISC License.

## Support 💬

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

## Roadmap 🗺️

### Planned Features
- [ ] TCGPlayer API integration
- [ ] Email notifications for price alerts
- [ ] Mobile app (React Native)
- [ ] Advanced analytics and charts
- [ ] Social features (sharing collections)
- [ ] Bulk import/export functionality
- [ ] Advanced search filters
- [ ] Card condition tracking
- [ ] Trading system

---

**Happy Collecting!** 🎴✨ 
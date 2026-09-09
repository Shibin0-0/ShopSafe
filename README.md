# ShopSafe – Expiry Tracker & Product Catalogue

ShopSafe is a full-stack web application for managing a product catalogue and tracking expiry dates, built as an academic mini project. Beyond simple record-keeping, it doubles as a lightweight inventory management tool — flagging items nearing expiry and sending notifications so nothing gets missed.

## Features

- **Product Catalogue** – add, view, and manage product records (name, category, quantity, expiry date)
- **Expiry Tracking** – automatically compares stored expiry dates against the current date
- **Notifications** – browser-based alerts (via service worker) for products nearing expiry
- **Dashboard UI** – a clean interface for browsing the catalogue and expiry status at a glance

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js |
| Database | MongoDB (via Mongoose ODM) |
| Frontend | HTML, CSS, JavaScript |
| Notifications | Service Worker (`sw.js`) |
| Config | dotenv, CORS |

## Project Structure

```
Shopsafe/
├── backend/
│   ├── controllers/
│   │   ├── productController.js
│   │   └── notificationController.js
│   ├── models/
│   ├── routes/
│   │   ├── productRoutes.js
│   │   └── notificationRoutes.js
│   └── server.js
├── dashboard.html
├── dashboard.js
├── landing.js
├── theme.js
├── sw.js
├── style.css
└── index.html
```

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) and npm installed
- A running MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### Installation

1. Clone the repo
   ```bash
   git clone https://github.com/your-username/Shopsafe.git
   cd Shopsafe/backend
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file inside `backend/` with:
   ```
   MONGO_URI=your_mongodb_connection_string
   ```

4. Start the server
   ```bash
   node server.js
   ```

5. Open your browser to `http://localhost:<port>` to view the dashboard.


## Team

Built collaboratively as part of an academic mini project.

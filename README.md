# MarketLink

**Farm fresh, just a click away.** A MERN web application that connects local farmers-market farmers with
customers. Farmers publish weekly stock and manage pre-orders; customers discover markets on a map, reserve
produce for pickup and leave reviews; an admin manages users, markets and content.

- `frontend/` - React 19 + Vite, React Router, Leaflet / OpenStreetMap
- `backend/` - Node.js + Express 5, MongoDB (Mongoose), JWT authentication

## Installation

### Prerequisites
- Node.js 18 or newer
- A MongoDB database (a free MongoDB Atlas cluster works)

### 1. Backend
```bash
cd backend
npm install
```

Create `backend/.env` (see `backend/.env.example`):

```
MONGO_URI=your_mongodb_connection_string
MONGO_DB_NAME=marketlink
PORT=5001
JWT_SECRET=a_long_random_string
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

- `MONGO_DB_NAME` gives the app its own database. Do not leave it out on a shared cluster, or the app will use the
  default `test` database (the seed script refuses to run there).
- Port 5000 is taken by AirPlay on macOS, so 5001 is used.

Create the collections and indexes, load test data, and start the server:

```bash
npm run db:init    # creates collections and indexes
npm run seed       # loads test users, market, categories, products
npm run dev        # http://localhost:5001  (health check: /api/health)
```

### 2. Frontend
```bash
cd frontend
npm install
```

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:5001
```

```bash
npm run dev        # http://localhost:5173
npm run build      # production build in frontend/dist
```

## User credentials (after `npm run seed`, password for all: `Password@123`)

| Role | E-mail |
|---|---|
| Admin | admin@marketlink.test |
| Farmer (approved) | farmer@marketlink.test |
| Farmer (pending approval) | pending.farmer@marketlink.test |
| Customer | customer@marketlink.test |


## Features
- **Customer:** register and log in, browse markets and farmers on a map (with directions), search and filter
  products (category, price, market, day), cart and pre-order with a pickup date and slot, view / modify / cancel
  orders before the cut-off, reorder, family account sharing (invite members, shared orders and favorites), favorites with restock alerts, reviews and ratings, in-app notifications,
  and a chatbot assistant.
- **Farmer:** stall profile (markets, operating days, pickup windows, cut-off, map pin), product management with
  images, sold-out / hide controls and a weekly stock template, accept / decline / ready / complete orders,
  dashboard (total and pending orders, revenue, best sellers) and replies to reviews.
- **Admin:** dashboard totals, approve or suspend farmers, activate or deactivate accounts, manage markets,
  moderate products and reviews, reports (revenue by market, most active farmers), categories and announcements.
- **Other:** role-based access control, responsive layout, About and Contact pages (with map).

## API overview (`/api`)

Send `Authorization: Bearer <token>` for protected routes.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/register-farmer`, `/auth/login`; `GET/PUT /auth/me`; `PUT /auth/password` |
| Markets | `GET /markets?day=&search=&lat=&lng=&radius=`, `GET /markets/:id`; admin: `POST/PUT/DELETE` |
| Categories | `GET /categories`; admin CRUD |
| Products | `GET /products?search=&category=&minPrice=&maxPrice=&market=&day=&sort=`, `GET /products/:id`; farmer: `GET /products/mine`, `POST`, `PUT /:id`, `PATCH /:id/status`, `POST /products/weekly-template/apply`, `DELETE` |
| Farmers | `GET /farmers`, `GET /farmers/:id`; farmer: `PUT /farmers/profile`, `GET /farmers/dashboard` |
| Orders | `POST /orders`, `GET /orders`, `GET /orders/:id`, `PUT /orders/:id`, `POST /orders/:id/cancel`, `GET /orders/:id/reorder`; farmer: `PATCH /orders/:id/status` |
| Reviews | `GET /reviews?farmer=` or `?product=`, `GET /reviews/order/:orderId`, `POST /reviews`, `PUT /reviews/:id/reply`, `DELETE /reviews/:id` |
| Customer | `GET /customer/favorites`, `PUT/DELETE /customer/favorites/:type/:id` |
| Family | `GET /family`, `GET /family/favorites`, `POST /family/invite`, `POST /family/invites/:from/accept\|decline`, `POST /family/leave`, `DELETE /family/members/:id`; `GET /orders?family=1` |
| Notifications | `GET /notifications`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`, `GET /notifications/announcements` |
| Admin | `GET /admin/dashboard`, `/admin/users`, `/admin/reviews`; `PATCH /admin/farmers/:id/status`, `/admin/users/:id/active`; `GET/POST /admin/reports`; `POST/DELETE /admin/announcements` |
| Other | `POST /chatbot`, `POST /uploads/image` |

## Database scripts (from `backend/`)
| Command | What it does |
|---|---|
| `npm run db:init` | Creates every collection and index defined by the models |
| `npm run seed` | Wipes this app's collections and loads the test data (refuses to run on the `test` database) |
| `npm run db:images` | Copies the files in `backend/uploads/` (catalog photos) into MongoDB; safe to re-run |

## Assumptions
- Payment is made in person at pickup; there is no payment gateway. Only pickup is supported (no delivery).
- Farmer identity, licences and food-safety certificates are not verified by the application; an admin approves
  farmer accounts manually.
- Pickup dates and times use the time zone of the server and browser (assumed to be the same).
- OpenStreetMap (Leaflet) is used for maps; no Google Maps API key is needed. Directions open in
  OpenStreetMap or Google Maps.
- Notifications are in-app; e-mail notifications are not sent.
- The chatbot is rule-based (keyword matching over live data), not a machine-learning model.
- Family account sharing is an invite-based group (up to 6 customers, each with their own login): members see each other's orders and favorites and can reorder, but only the person who placed an order can modify or cancel it.
- Uploaded product images are stored in MongoDB (`images` collection) and served from `/uploads/<path>`, so no persistent disk is needed. Max 2 MB each (JPG, PNG, WEBP).

## Hosting notes
Build the frontend (`npm run build`) and serve `frontend/dist` from any static host. Run the backend with
`npm start` and set `CLIENT_URL` to the frontend's address and `VITE_API_URL` (at build time) to the backend's address.

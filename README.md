OURHOUSE INVENTORY MANAGEMENT SYSTEM – README

PROJECT OVERVIEW
OurHouse is a full-stack inventory management system built using React (frontend), Node.js/Express (backend), and PostgreSQL (database). It allows organizations to track products, manage stock levels, process shipments, organize warehouse locations, import/export product data, and maintain accurate inventory records.
This system was developed as part of Wayne State University CSC 4110 – Software Engineering. It includes full CRUD functionality, role-based access control, and CSV automation tools for efficient warehouse operations.

KEY FEATURES

INVENTORY FEATURES
Create, edit, and delete products
Track SKU, product description, units, and stock quantities
Low-stock detection and banners
Product activity and change history

WAREHOUSE FEATURES
Manage locations, bins, and storage areas
Track stock at specific warehouse locations

CSV IMPORT/EXPORT
Shipment receiving via CSV import
Stock reconciliation tools
Bulk new product upload
Full inventory export

ADMINISTRATION
Role-based user management (Admin, Manager, Worker, Viewer)
Delete products and locations
System-wide activity logs

USER ROLES
Admin: Full control of system
Manager: All inventory and location operations
Worker: Restricted access to operational tasks
Viewer: Can view the database

OTHER CAPABILITIES

REST API backend
Real-time data updates
Backend and frontend validation
PostgreSQL relational schema with foreign keys
Optimized query performance and error handling

TECHNOLOGY STACK

FRONTEND
React
Axios
React Hooks and functional components

BACKEND
Node.js
Express.js
pg PostgreSQL client
bcrypt

DATABASE
PostgreSQL
SQL migration and schema scripts in /server/sql/

DEV/TOOLS
npm and Node.js environment
GitHub Actions CI 
Jest tests 

PROJECT STRUCTURE
OurHouse-Project/
frontend/
src/
public/
package.json
server/
controllers/
routes/
sql/
models/
app.js
server.js
package.json
README.md

INSTALLATION AND SETUP
Clone the repository:
git clone https://github.com/WSU-4110/OurHouse-Project.git
cd OurHouse-Project

BACKEND SETUP
Navigate to server folder:
cd server
Install backend dependencies:
npm install
Create environment variable file (.env) inside /server:
DATABASE_URL=postgres://username:password@localhost:5432/ourhouse
PORT=3000
Initialize the PostgreSQL database. Using the files in /server/sql/:
setup.sql
Run these inside PostgreSQL:
\i setup.sql;
Start backend server:
npm start
Backend runs by default at:
http://localhost:3000

FRONTEND SETUP
Navigate to frontend folder:
cd ../frontend
Install dependencies:
npm install
Start development server:
npm start
Frontend runs at:
Vite: http://localhost:5173
CRA: http://localhost:3001

CREDITS AND CONTRIBUTORS

CSC 4110 – OurHouse Team

Tristan Sexton
Backend development, CSV import/export system, shipment receiving tools, deletion tools for products and locations, admin panel logic, backend debugging, unit tests, database fixes.
Contributed to NFR-1 Security, NFR-2 Performance, NFR-3 Reliability/Consistency, NFR-4 Usability, NFR-5 Availability, and NFR-5 Maintainability/CI.
Contributed to FR-1 Receive Inventory, FR-2 Ship Inventory, FR-8 Manage Products, FR-9 Manage Locations/Bins, FR-10 Movement History + CSV Export, FR-11 CSV Import/Export, and FR-13 Prevent Negative Stock.

Hussein El-Habhab
Frontend engineering, backend integration, authentication system, inventory movement logic, optimization for performance, API development, UI/UX improvements.
Contributed to NFR-1 Security, NFR-2 Performance, NFR-3 Reliability/Consistency, NFR-4 Usability, NFR-5 Availability, and NFR-5 Maintainability/CI.
Contributed to FR-1 Receive Inventory, FR-2 Ship Inventory, FR-3 Transfer Inventory, FR-4 View Current Stock, FR-5 Movement Notes, FR-7 Login/Logout + RBAC, FR-8 Manage Products, FR-9 Manage Locations/Bins, FR-10 Movement History + CSV Export, FR-12 Daily Low-Stock Email, FR-13 Prevent Negative Stock, FR-14 ACID Movement Updates, and FR-15 Idempotency for Movement Endpoints.

Gunnar Dlugas
Implemented the In-App Low-Stock Banner system (FR-6).

LICENSE
This project was created for academic use under Wayne State University CSC 4110 – Software Engineering. No commercial license intended.

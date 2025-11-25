Installation Guide
This document describes the required software, system requirements, and instructions to build and install the OurHouse Inventory Management System.

SYSTEM REQUIREMENT

Operating System
Windows 10 or 11
macOS (Intel or Apple Silicon)
Linux (Ubuntu 20.04+, Debian, Fedora)

Hardware Requirements
CPU: Dual-core processor
RAM: 4 GB minimum (8 GB recommended)
Storage: 2 GB free
Internet connection required for package installation

Required Software
Node.js (version 18 or higher)
npm (included with Node.js)
PostgreSQL 14
Git

Optional but Recommended
pgAdmin or TablePlus (database GUI)
Visual Studio Code or another modern IDE

REPOSITORY SETUP
Clone the repository:
git clone https://github.com/WSU-4110/OurHouse-Project.git
cd OurHouse-Project

This project contains two major components:
/server → Node.js backend
/frontend → React frontend

BACKEND INSTALLATION (Node.js / Express)
Navigate to the backend:
cd server
Install backend dependencies:
npm install

Environment Variables
Create a file named .env inside /server:

DATABASE_URL=postgres://username:password@localhost:5432/ourhouse
PORT=3000
JWT_SECRET=your_secret_here

Replace username and password with your PostgreSQL credentials.

DATABASE SETUP (PostgreSQL)
Create the database:
createdb ourhouse
Navigate to the SQL folder:
cd server/sql
Open the PostgreSQL shell:
psql -d ourhouse
Run the SQL setup files:
\i setup.sql;
Exit PostgreSQL:
\q

The database is now fully initialized.

RUNNING THE BACKEND
Navigate back to the server directory if needed:
cd ..
Start the backend server:
npm start
The backend will run at:
http://localhost:3000

FRONTEND INSTALLATION (React)
Open a second terminal window and navigate to the frontend folder:
cd frontend
Install frontend dependencies:
npm install
Start the frontend development server:
npm start
The frontend will run at:
Vite: http://localhost:5173

VERIFYING THE INSTALLATION
Ensure PostgreSQL is running
Start backend with: npm start (inside /server)
Start frontend with: npm start (inside /frontend)
Log in using provided seed credentials if applicable
Test adding and editing a product
Test CSV import and export
Verify stock updates, movements, and locations

INSTALLATION COMPLETE

The OurHouse Inventory Management System is now installed.
For additional information, see the README file or contact the project team.

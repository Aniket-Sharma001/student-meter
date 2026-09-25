# RoomMate Manager

RoomMate Manager is a beginner-friendly hostel and room expense management project for students living together. It helps roommates manage rent, electricity, groceries, daily expenses, payments, member balances, and monthly summaries.

## Project Goal
The project is designed to be simple enough for a Diploma CSE student to understand while still being realistic and useful in a real hostel or shared room setup.

## Project Structure

```text
roommate-manager/
├── backend/
│   ├── pom.xml
│   └── src/
│       ├── main/
│       │   ├── java/com/roommate/manager/
│       │   │   ├── config/
│       │   │   ├── controller/
│       │   │   ├── dto/
│       │   │   ├── entity/
│       │   │   ├── repository/
│       │   │   └── security/
│       │   └── resources/
│       │       └── application.properties
│       └── test/
├── database/
│   └── schema.sql
├── frontend/
│   ├── index.html
│   ├── register.html
│   ├── dashboard.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── auth.js
│       └── dashboard.js
└── README.md
```

## Step-by-Step Development Order

### 1) Project Architecture
The project is split into three main parts:

- Frontend: HTML, CSS, JavaScript for user screens and forms.
- Backend: Java + Spring Boot for APIs and business logic.
- Database: MySQL for storing users, rooms, expenses, payments, and reports.

### 2) Database ER-style Relationship Explanation
- A user can register and create their profile.
- A room belongs to a user (created_by), but many members can join it.
- A room has many room_member records.
- Each room has many expenses.
- Each expense can create many split records for each roommate.
- Each room has rent and electricity entries per month.
- Each room has many payments between users.
- Each room can generate notifications.

Simple relationship idea:

- users 1 --- * rooms
- rooms 1 --- * room_members
- users 1 --- * room_members
- rooms 1 --- * expenses
- expenses 1 --- * expense_splits
- users 1 --- * expense_splits
- rooms 1 --- * payments
- users 1 --- * payments

### 3) Database SQL
The SQL schema is located in [database/schema.sql](database/schema.sql).

It creates the database named `roommate_manager` and necessary tables like:
- users
- rooms
- room_members
- expenses
- expense_splits
- rent
- electricity_bills
- payments
- notifications

### 4) Backend Setup
Create a Spring Boot project using Maven. The project configuration is in [backend/pom.xml](backend/pom.xml).

Important dependencies:
- spring-boot-starter-web
- spring-boot-starter-data-jpa
- spring-boot-starter-security
- spring-boot-starter-validation
- mysql-connector-j
- jjwt

### 5) Backend Code
Key backend files created:
- [backend/src/main/java/com/roommate/manager/RoommateManagerApplication.java](backend/src/main/java/com/roommate/manager/RoommateManagerApplication.java)
- [backend/src/main/java/com/roommate/manager/config/SecurityConfig.java](backend/src/main/java/com/roommate/manager/config/SecurityConfig.java)
- [backend/src/main/java/com/roommate/manager/controller/AuthController.java](backend/src/main/java/com/roommate/manager/controller/AuthController.java)
- [backend/src/main/java/com/roommate/manager/entity/User.java](backend/src/main/java/com/roommate/manager/entity/User.java)
- [backend/src/main/java/com/roommate/manager/repository/UserRepository.java](backend/src/main/java/com/roommate/manager/repository/UserRepository.java)
- [backend/src/main/java/com/roommate/manager/security/CustomUserDetailsService.java](backend/src/main/java/com/roommate/manager/security/CustomUserDetailsService.java)
- [backend/src/main/java/com/roommate/manager/security/JwtTokenProvider.java](backend/src/main/java/com/roommate/manager/security/JwtTokenProvider.java)
- [backend/src/main/java/com/roommate/manager/security/JwtAuthenticationFilter.java](backend/src/main/java/com/roommate/manager/security/JwtAuthenticationFilter.java)
- [backend/src/main/java/com/roommate/manager/dto/RegisterRequest.java](backend/src/main/java/com/roommate/manager/dto/RegisterRequest.java)
- [backend/src/main/java/com/roommate/manager/dto/LoginRequest.java](backend/src/main/java/com/roommate/manager/dto/LoginRequest.java)
- [backend/src/main/java/com/roommate/manager/dto/AuthResponse.java](backend/src/main/java/com/roommate/manager/dto/AuthResponse.java)

These files handle registration, login, JWT authentication, password hashing, and secure API access.

### 6) Frontend Code
The frontend is simple and beginner-friendly. Main pages:
- [frontend/index.html](frontend/index.html): login page
- [frontend/register.html](frontend/register.html): registration page
- [frontend/dashboard.html](frontend/dashboard.html): dashboard screen
- [frontend/css/style.css](frontend/css/style.css): styling and responsive layout
- [frontend/js/auth.js](frontend/js/auth.js): login and registration logic
- [frontend/js/dashboard.js](frontend/js/dashboard.js): dashboard and logout behavior

### 7) JavaScript API Integration
The frontend communicates with the backend using `fetch()`.

Example flow:
1. User logs in.
2. Frontend sends email and password to `/api/auth/login`.
3. Backend validates and returns a JWT.
4. Frontend stores the token in `localStorage`.
5. Each future request uses the token in the `Authorization` header.

### 8) Testing Instructions
Before running the backend, create MySQL database and start MySQL server.

1. Open MySQL command line or MySQL Workbench.
2. Create database:

```sql
CREATE DATABASE roommate_manager;
```

3. Run the SQL schema from [database/schema.sql](database/schema.sql).
4. Update database credentials in [backend/src/main/resources/application.properties](backend/src/main/resources/application.properties).
5. Run backend:

```bash
cd roommate-manager/backend
mvn spring-boot:run
```

6. Run frontend:

```bash
cd roommate-manager/frontend
python -m http.server 8001
```

7. Open:
- http://localhost:8001/index.html

### 9) How to Run the Project
For Windows: 

```bash
cd C:\path\to\roommate-manager\backend
mvn spring-boot:run
```

Then in another terminal:

```bash
cd C:\path\to\roommate-manager\frontend
python -m http.server 8001
```

### 10) Common Errors and Solutions

#### Error: Maven not found
Install Maven and add it to PATH.

#### Error: MySQL connection refused
Check whether MySQL is running and confirm username/password in application.properties.

#### Error: Access denied or unauthorized
Make sure the JWT token is sent in the Authorization header.

#### Error: Duplicate email
This is prevented by the backend registration validation.

#### Error: Page not loading
Check if the frontend server is running on port 8001 and if the browser URL is correct.

## Notes
This project is designed to be a solid diploma-level minor project demonstration. It gives you a practical example of: security, database design, REST API, and responsive frontend development.

## Verification Status
I verified that the frontend login page loads in the browser at `http://localhost:8001/index.html`.

The backend Java build could not be fully verified in this environment because Apache Maven is not installed here (`mvn` command was not recognized). You should run the backend on your Windows machine after installing Maven and MySQL.

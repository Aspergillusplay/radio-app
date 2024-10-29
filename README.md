# Radio App

This project is a radio application built with React and TypeScript, using Vite for the build tool. It integrates Firebase for authentication and other backend services.

## Features

- **React**: A JavaScript library for building user interfaces.
- **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript.
- **Vite**: A build tool that aims to provide a faster and leaner development experience for modern web projects.
- **Firebase**: A platform developed by Google for creating mobile and web applications.

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/Aspergillusplay/radio-app.git
    ```

2. Navigate to the project directory:

    ```bash
    cd radio-app
    ```

3. Install the dependencies:

    ```bash
    npm install
    ```

### Running the Application

To start the development server, run:

```bash
npm run dev
```

## Setting Up Firebase

To configure Firebase in your project, you’ll need to add a `Firebase.ts` file in the `src` directory with your Firebase configuration details.

1. Visit the Firebase Console and set up a new project or use an existing one.

2. In the project settings, locate the Firebase configuration code (you can find this under Project Settings > General > Your Apps).

3. Create a new file named `Firebase.ts` in the `src` folder, and paste the Firebase configuration code provided by Firebase into this file. For example:

```typescript
// src/Firebase.ts
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id",
};

const app = initializeApp(firebaseConfig);

export default app;
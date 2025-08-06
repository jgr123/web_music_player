import React from 'react';
import { createRoot } from 'react-dom/client'; // Importe createRoot
import App from './App';
import { AuthProvider } from './AuthContext';

// 1. Obtenha o elemento raiz
const container = document.getElementById('root');

// 2. Crie a raiz
const root = createRoot(container);

// 3. Renderize o aplicativo
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
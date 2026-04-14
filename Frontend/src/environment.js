const server = import.meta.env.VITE_API_URL
    || (import.meta.env.DEV
        ? "http://localhost:8000"
        : "https://connectxbackend-3dg1.onrender.com");


export default server;

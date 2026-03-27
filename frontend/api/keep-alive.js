// API route handler function
export default async function handler(req, res) {
    try {
        // Get backend URL from environment variable,
        // fallback to default production backend if not defined
        const backendUrl =
            process.env.VITE_API_URL || "https://nyayaai-backend.onrender.com";

        // Send a GET request to the backend health endpoint
        const response = await fetch(`${backendUrl}/health`, {
            method: "GET",
            headers: { Accept: "application/json" }, // Expect JSON response
        });

        // Parse the JSON response from backend
        const data = await response.json();

        // Send success response to client with backend health data
        res.status(200).json({
            status: "ok",
            timestamp: new Date().toISOString(), // Current server timestamp
            backend: data, // Backend health response
        });
    } catch (error) {
        // Handle errors (network issues, backend down, etc.)
        res.status(500).json({
            status: "error",
            timestamp: new Date().toISOString(), // Current server timestamp
            message: error.message, // Error message for debugging
        });
    }
}

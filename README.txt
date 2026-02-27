INSTAGRAM REELS SCRAPER
A web application designed to batch scrape data and metrics from Instagram Reels. Users can feed links into the system by either uploading an Excel/CSV file or directly pasting URLs, and the application will extract details like play count, likes, comments, caption, and more via Apify.

FEATURES
* **File Upload Support**: Upload .csv, .xlsx, or .xls files. The system automatically searches for columns containing Instagram reel links.
* **Direct Link Input**: Paste multiple Instagram reel URLs directly into the UI.
* **Strict Validation**: Ensures only valid Instagram format links (e.g., /reel/, /reels/, /p/, /tv/) are processed.
* **Configurable Exports**: Choose exactly which scraped fields (e.g., shortcode, username, likes, comments, videoplaycount) to include in your final downloaded CSV report.
* **Real-time Progress**: Track the scraping process in real-time.

SETUP & LOCAL DEVELOPMENT
This project uses a Node.js Express backend and a React/Next.js frontend.

Prerequisites:
* Node.js (v18+)
* An active Apify account with an API token.

1. BACKEND SETUP
* Navigate to the backend directory:
   cd backend
* Install dependencies:
   npm install
* Create a .env file in the backend directory and add your Apify token:
   APIFY_API_TOKEN=your_apify_token_here
* Start the server:
   npm start
   (The backend will run on http://localhost:8000.)

2. FRONTEND SETUP
* Open a new terminal and navigate to the frontend directory:
   cd frontend
* Install dependencies:
   npm install
* Start the development server:
   npm run dev
   (The frontend will run on http://localhost:3000.)

HOW TO USE
1. **Access the App**: Open http://localhost:3000 in your browser.
2. **Input Links**:
   - **Upload File**: Drag and drop an Excel (.xlsx/.xls) or CSV file into the upload zone. The file must contain a column with your Instagram links.
   - **Paste Links**: Click the "Paste Links" tab to manually paste multiple Instagram URLs (one per line). 
3. **Start Scraping**: Click the "Start Extracting" button. The app will communicate with the Apify actor and display live progress.
4. **Configure Export fields**: Once extraction is complete, you can click the gear/settings icon next to the download button to select which specific data points you want to download.
5. **Download**: Click "Download CSV" to receive a merged .csv document containing your original input data alongside the newly scraped metrics.

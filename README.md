# SnapSafe

This project integrates Walrus, a decentralized storage solution, for storing and retrieving screenshots. Here's a summary of how Walrus is integrated:

## 1. Configuration

- The Walrus API endpoint is defined: 
  ```javascript
  const WALRUS_API = "http://127.0.0.1:31415"
  ```
- The Walrus publisher endpoint is defined: 
  ```javascript
  const WALRUS_PUBLISHER = "https://walrus-testnet-publisher.nodeinfra.com"
  ```

## 2. UI Integration

- There's a "Upload to Walrus" button in the toolbar.

## 3. Uploading to Walrus

The `uploadToWalrus` function handles the upload process:

- It creates a FormData object with the screenshot blob.
- Sends a PUT request to the Walrus publisher endpoint.
- Returns the Blob ID of the uploaded file.

## 4. Sharing Walrus Links

- After successful upload, the `showShareLink` function is called with the Blob ID.
- It displays a modal with the Blob ID and options to copy it or view the file on Walrus.

# Secure QR Code App

SecureQRCodeApp is an open-source secure QR transfer tool with:

- A Python desktop application for encrypting and decrypting messages and files.
- A browser application in `web/` for client-side encryption and QR transfer.

The web application performs encryption in the browser. Plaintext data and passwords are not uploaded to a server.

## Features

### Web application

- Encrypt private messages with AES-256-GCM.
- Encrypt any file type up to 10 MB, including images, PDFs, archives and other binary files.
- Derive encryption keys with PBKDF2-SHA-256 and 600,000 iterations.
- Split larger encrypted payloads into numbered QR fragments.
- Download QR images or copy the encrypted payload sequence.
- Reassemble pasted or scanned QR fragments during unlock.
- Detect missing, duplicate and mismatched QR fragments.
- Download the original file after successful decryption.
- No account or server upload required.
- Preserve compatibility with the original legacy Python payload format.

### Desktop application

- Generate QR codes from messages or files.
- Encrypt content with a password.
- Decrypt QR codes with password validation.
- Password strength feedback.
- GUI-based encryption and decryption workflows.
- Optional file viewing support in the desktop application.

## Repository structure

```text
src/
  qr_encrypt_gui.py       Desktop encryption GUI
  qr_decrypt_gui.py       Desktop decryption GUI
web/
  index.html              Browser application page
  app.js                  Browser UI and QR transfer logic
  crypto-core.js          Web Crypto encryption/decryption logic
  styles.css              Browser application styles
```

## Requirements

### Desktop application

- Python 3.10 or newer
- `qrcode`
- `opencv-python`
- `pillow`
- `cryptography`
- `PyMuPDF`
- Tkinter

Install the Python dependencies:

```bash
cd SecuredQRCodeApp
python -m pip install -r requirements.txt
```

### Web application

The web application has no build step and uses browser APIs plus QR libraries loaded from jsDelivr. A modern browser with Web Crypto API support is required.

## Run the desktop application

From the repository root:

```bash
python src/qr_encrypt_gui.py
```

In a second terminal, run the decryptor:

```bash
python src/qr_decrypt_gui.py
```

## Run the web application locally

From the repository root, start a local static server:

```bash
python -m http.server 8000 --directory web
```

Open [http://localhost:8000](http://localhost:8000).

The web application supports messages and binary files up to 10 MB. Large encrypted payloads are divided into multiple QR codes because a single QR code has limited capacity.


## Build Windows executables

Install PyInstaller:

```bash
python -m pip install pyinstaller
```

Build the desktop applications from the repository root:

```bash
pyinstaller --onefile --noconsole src/qr_encrypt_gui.py
pyinstaller --onefile --noconsole src/qr_decrypt_gui.py
```

Do not commit generated `.exe` files to the repository. Publish them through GitHub Releases instead.

## Security notes

- QR codes contain encrypted data, but anyone who obtains a QR image can attempt to unlock it.
- Use a long, unique password and share it through a separate channel.
- SecureQR is intended for temporary transfers, not permanent storage.
- GitHub Pages serves the static web files, but it does not receive the plaintext message, original file or password during browser encryption.

## License

See the repository for licensing information.

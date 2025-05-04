✅ Project Overview

🚀 Features

💻 Requirements

📦 Installation

🧪 Usage

📄 Release Notes

📁 Folder Structure

📥 How to Download .exe

**✅ Updated README.md**
# Secure QR Code App

A Python-based secure QR code generator and decoder with encryption, decryption, password protection, and GUI support. This tool allows users to store confidential messages or files securely into QR codes and decrypt them with safety mechanisms like view-only mode and password validation.

---

## 🚀 Features

- Generate QR codes from messages or files
- Encrypt content with a custom password
- Decrypt QR codes using password or non-password option
- Password strength indicator (with color feedback)
- Prevents unauthorized saving or sharing of decrypted content
- Embedded viewer for files (PDF/Image) with no download option
- GUI-based interface for both encrypting and decrypting
- Packaged as `.exe` for easy use (see [Releases](../../releases))

---

## 💻 Requirements

Make sure you have Python 3.10+ and install these dependencies:

```bash
pip install qrcode opencv-python pillow cryptography PyMuPDF tkinter
```
**📦 Installation**
**git clone https://github.com/Nagarjunareddy4/SecureQRCodeApp.git
cd SecureQRCodeApp**

If you'd like to build the .exe:
**pip install pyinstaller
pyinstaller --onefile --noconsole qr_encrypt_gui.py
pip install pyinstaller
pyinstaller --onefile --noconsole qr_decrypt_gui.py
**
  Note: Do not commit .exe to GitHub, instead see "Releases".

**🧪 Usage
🔐 Generate Secure QR Code**
Run the encryption GUI:
  **python qr_encrypt_gui.py**
  
Choose to encrypt message or file

Enter a password (strength meter visible)

Click “Generate QR” and save the QR image

**🔓 Decrypt QR Code**
Run the decryption GUI:

**python qr_decrypt_gui.py**

Choose whether the QR is password protected or not
Upload the QR image
Enter the password (if required)
_**If it's a message → it displays
If it's a file → it opens with view-only access**_

**📄 Release Notes**
**v1.0.0 **(First Release)
Initial working version of QR Encrypt and Decrypt tools
GUI with password strength meter
File preview with viewing restrictions
.exe included in Releases

**📥 Download .exe**
Visit the Releases page to download the .exe files if you do not want to run the source code manually.



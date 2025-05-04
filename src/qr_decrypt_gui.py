import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk
import cv2
import base64
import io
import fitz  # PyMuPDF
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

# Generate Fernet key using password and salt
def generate_key(password, salt):
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(), length=32, salt=salt,
        iterations=100_000, backend=default_backend()
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))

# Decrypt function
def decrypt_data(encrypted_data, password=None):
    try:
        data = base64.urlsafe_b64decode(encrypted_data.encode())
        if password:
            salt = data[:16]
            encrypted_payload = data[16:]
            key = generate_key(password, salt)
            f = Fernet(key)
            return f.decrypt(encrypted_payload)
        else:
            return data
    except Exception as e:
        return f"Error: {e}"

# Decode QR
def decode_qr_from_image(image_path):
    image = cv2.imread(image_path)
    qr_detector = cv2.QRCodeDetector()
    data, _, _ = qr_detector.detectAndDecode(image)
    return data

# Display image in GUI
def display_image(data_bytes):
    try:
        img = Image.open(io.BytesIO(data_bytes))
        img.thumbnail((400, 400))
        img_tk = ImageTk.PhotoImage(img)
        img_label.config(image=img_tk)
        img_label.image = img_tk
        output_text.delete("1.0", tk.END)
        output_text.insert(tk.END, "[🔍 Image displayed below. Not savable]")
    except Exception as e:
        messagebox.showerror("Error", f"Could not display image: {e}")

# Display PDF in GUI (first page only)
def display_pdf(data_bytes):
    try:
        doc = fitz.open(stream=data_bytes, filetype="pdf")
        page = doc.load_page(0)
        pix = page.get_pixmap()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        img.thumbnail((400, 400))
        img_tk = ImageTk.PhotoImage(img)
        img_label.config(image=img_tk)
        img_label.image = img_tk
        output_text.delete("1.0", tk.END)
        output_text.insert(tk.END, "[📄 PDF preview displayed below. First page only]")
    except Exception as e:
        messagebox.showerror("Error", f"Could not display PDF: {e}")

# Handle decryption logic
def handle_decryption():
    is_protected = qr_type.get()
    qr_path = filedialog.askopenfilename(filetypes=[("Image Files", "*.png;*.jpg;*.jpeg")])
    if not qr_path:
        return

    qr_data = decode_qr_from_image(qr_path)
    if not qr_data:
        messagebox.showerror("Error", "No QR code found.")
        return

    password = password_entry.get() if is_protected == "protected" else None
    decrypted = decrypt_data(qr_data, password)

    if isinstance(decrypted, bytes):
        try:
            # PDF
            if decrypted[:4] == b'%PDF':
                display_pdf(decrypted)
            # Image
            elif decrypted[:4] in [b'\x89PNG', b'\xff\xd8\xff\xe0', b'\xff\xd8\xff\xe1']:
                display_image(decrypted)
            else:
                # Text
                output_text.delete("1.0", tk.END)
                output_text.insert(tk.END, decrypted.decode())
                img_label.config(image='')  # clear image
        except Exception as e:
            messagebox.showerror("Error", f"Decryption failed: {e}")
    else:
        messagebox.showerror("Error", decrypted)

# GUI Setup
root = tk.Tk()
root.title("Secure QR Code Decryption with Preview")
root.geometry("600x600")
root.configure(bg="#f4f4f4")

tk.Label(root, text="Is the QR Code Password Protected?", bg="#f4f4f4", font=("Arial", 12)).pack(pady=10)
qr_type = tk.StringVar(value="protected")
tk.Radiobutton(root, text="Yes", variable=qr_type, value="protected", bg="#f4f4f4").pack()
tk.Radiobutton(root, text="No", variable=qr_type, value="unprotected", bg="#f4f4f4").pack()

tk.Label(root, text="Enter Password (if required):", bg="#f4f4f4", font=("Arial", 10)).pack(pady=5)
password_entry = tk.Entry(root, show="*", width=40, font=("Arial", 11))
password_entry.pack()

tk.Button(root, text="Select QR Code & Decrypt", command=handle_decryption,
          bg="#4CAF50", fg="white", font=("Arial", 12)).pack(pady=20)

output_text = tk.Text(root, height=5, width=60, font=("Arial", 10), wrap=tk.WORD)
output_text.pack(pady=10)

img_label = tk.Label(root, bg="#f4f4f4")
img_label.pack(pady=10)

root.mainloop()

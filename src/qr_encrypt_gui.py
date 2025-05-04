import tkinter as tk
from tkinter import filedialog, messagebox
import base64
import qrcode
import os
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

# Generate encryption key
def generate_key(password, salt):
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
        backend=default_backend()
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))

# Encrypt the data
def encrypt_data(data, password):
    salt = os.urandom(16)
    key = generate_key(password, salt)
    fernet = Fernet(key)
    encrypted = fernet.encrypt(data)
    combined = base64.urlsafe_b64encode(salt + encrypted)
    return combined

# Handle generate button click
def generate_qr():
    mode = input_mode.get()
    password = password_entry.get()

    if not password:
        messagebox.showerror("Error", "Please enter a password.")
        return

    if mode == "message":
        message = message_entry.get("1.0", tk.END).strip()
        if not message:
            messagebox.showerror("Error", "Message is empty.")
            return
        data = message.encode()

    elif mode == "file":
        if not selected_file_path.get():
            messagebox.showerror("Error", "No file selected.")
            return
        try:
            with open(selected_file_path.get(), "rb") as file:
                data = file.read()
        except Exception as e:
            messagebox.showerror("Error", f"File read failed: {e}")
            return

    else:
        messagebox.showerror("Error", "Unknown input mode.")
        return

    encrypted_data = encrypt_data(data, password)

    # Generate QR
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(encrypted_data.decode())
    qr.make(fit=True)
    img = qr.make_image(fill="black", back_color="white")

    save_path = filedialog.asksaveasfilename(defaultextension=".png", filetypes=[("PNG Files", "*.png")])
    if save_path:
        img.save(save_path)
        messagebox.showinfo("Success", f"QR Code saved as {save_path}")

# File picker
def pick_file():
    file_path = filedialog.askopenfilename()
    if file_path:
        selected_file_path.set(file_path)

# Update input area based on selection
def update_input_mode():
    if input_mode.get() == "message":
        message_entry.config(state="normal")
        file_button.config(state="disabled")
    else:
        message_entry.config(state="disabled")
        file_button.config(state="normal")

def check_password_strength(event=None):
    pwd = password_entry.get()
    if len(pwd) < 6:
        strength.set("Weak 🔴")
    elif any(c.isdigit() for c in pwd) and any(c.isalpha() for c in pwd) and len(pwd) >= 8:
        strength.set("Strong 🟢")
    else:
        strength.set("Medium 🟠")


# GUI
root = tk.Tk()
root.title("Secure QR Code Generator")
root.geometry("500x400")
root.configure(bg="#f8f8f8")

input_mode = tk.StringVar(value="message")
selected_file_path = tk.StringVar()

tk.Label(root, text="Select Input Type:", bg="#f8f8f8", font=("Arial", 12)).pack(pady=5)
tk.Radiobutton(root, text="Message", variable=input_mode, value="message", command=update_input_mode, bg="#f8f8f8").pack()
tk.Radiobutton(root, text="File", variable=input_mode, value="file", command=update_input_mode, bg="#f8f8f8").pack()

message_entry = tk.Text(root, height=6, width=50, font=("Arial", 10), borderwidth=2, relief="solid")
message_entry.pack(pady=10)

file_button = tk.Button(root, text="Select File", command=pick_file, state="disabled")
file_button.pack(pady=5)

tk.Label(root, text="Set Password:", bg="#f8f8f8", font=("Arial", 12)).pack()
password_entry = tk.Entry(root, show="*", width=40, font=("Arial", 12), borderwidth=2, relief="solid")
password_entry.pack(pady=5)

tk.Button(root, text="Generate QR Code", command=generate_qr, bg="#4CAF50", fg="white", font=("Arial", 12)).pack(pady=20)

strength = tk.StringVar()
tk.Label(root, textvariable=strength, bg="#f8f8f8", font=("Arial", 10, "italic"), fg="gray").pack()
password_entry.bind("<KeyRelease>", check_password_strength)

root.mainloop()

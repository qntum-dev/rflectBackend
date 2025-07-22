export function validatePassword(password:string, email:string):string {
  
    if (password.length < 8) {
      return "Must be at least 8 characters long.";
    }
    if (!/[a-z]/.test(password)) {
      return "Must include at least one lowercase letter.";
    }
    if (!/[A-Z]/.test(password)) {
      return "Must include at least one uppercase letter.";
    }
    if (!/\d/.test(password)) {
      return "Must include at least one number.";
    }
    if (!/[\W_]/.test(password)) {
      return "Must include at least one special character.";
    }
  
    if (email) {
      const emailParts = email.split(/[@._\-]/).filter(Boolean);
      for (const part of emailParts) {
        if (part && password.toLowerCase().includes(part.toLowerCase())) {
          return "Password should not contain parts of your email address.";
        }
      }
    }
    
    return "ok"
  }
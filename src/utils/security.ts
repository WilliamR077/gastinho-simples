// Utility functions for security and validation

export interface PasswordStrength {
  score: number;
  feedback: string[];
  isValid: boolean;
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push("Use pelo menos 8 caracteres");
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Inclua pelo menos uma letra maiúscula");
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Inclua pelo menos uma letra minúscula");
  }

  // Number check
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push("Inclua pelo menos um número");
  }

  // Special character check
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Inclua pelo menos um caractere especial");
  }

  return {
    score,
    feedback,
    isValid: score >= 4 && password.length >= 8
  };
}

export function sanitizeErrorMessage(error: any): string {
  // Common error messages that should be sanitized
  const sanitizedMessages: Record<string, string> = {
    'Invalid login credentials': 'Email ou senha incorretos',
    'Email not confirmed': 'Confirme seu email antes de fazer login',
    'User not found': 'Email ou senha incorretos',
    'Invalid email': 'Email inválido',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
    'User already registered': 'Este email já está cadastrado',
    'signup disabled': 'Cadastro temporariamente desabilitado',
    'Email rate limit exceeded': 'Muitas tentativas. Tente novamente em alguns minutos',
  };

  const errorMessage = error?.message || 'Erro desconhecido';
  
  // Return sanitized message if available, otherwise return a generic message
  return sanitizedMessages[errorMessage] || 'Ocorreu um erro. Tente novamente.';
}

export function isEmailValid(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
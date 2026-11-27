// Mensagens de erro e aviso exibidas a partir de ?erro= e ?aviso= na URL.
export const ERRORS: Record<string, string> = {
  credenciais: 'E-mail ou senha incorretos.',
  'email-nao-confirmado': 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
  'usuario-invalido': 'O @usuário deve ter de 3 a 24 caracteres: letras minúsculas, números, ponto ou sublinhado.',
  'senha-curta': 'A senha precisa ter pelo menos 10 caracteres.',
  'senhas-diferentes': 'As senhas não coincidem.',
  'cadastro-falhou': 'Não foi possível criar a conta. Tente outro e-mail ou tente mais tarde.',
  'link-invalido': 'Este link expirou ou já foi usado. Solicite um novo.',
  'google-falhou': 'Não foi possível entrar com o Google. Tente novamente.',
  'senha-falhou': 'Não foi possível alterar a senha. Tente novamente.',
  muitas: 'Muitas tentativas seguidas. Aguarde alguns minutos.',
};

export const NOTICES: Record<string, string> = {
  'confirme-email': 'Conta criada. Enviamos um link de confirmação para o seu e-mail.',
  'link-enviado': 'Se houver uma conta com este e-mail, enviamos um link para redefinir a senha. Ele vale por 1 hora.',
  'senha-alterada': 'Senha alterada. As sessões nos outros dispositivos foram encerradas.',
  'saiu': 'Você saiu da sua conta.',
};

export function pickMessage(map: Record<string, string>, key: string | string[] | undefined) {
  const k = Array.isArray(key) ? key[0] : key;
  return k ? map[k] : undefined;
}

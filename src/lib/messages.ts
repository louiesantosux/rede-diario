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
  'email-em-uso': 'Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.',
  'email-nao-autorizado': 'O envio de e-mails ainda não está liberado para este endereço. Configure um SMTP próprio no Supabase.',
  'limite-email': 'Limite de envio de e-mails atingido. Tente novamente em uma hora.',
  'senha-fraca': 'Senha muito fraca ou já exposta em vazamentos. Escolha outra.',
  'email-invalido': 'E-mail inválido.',
  'cadastro-desativado': 'Novos cadastros estão desativados no momento.',
  'erro-banco': 'Erro ao criar o perfil. Tente outro @usuário.',
};

export const NOTICES: Record<string, string> = {
  'confirme-email': 'Conta criada. Enviamos um link de confirmação para o seu e-mail.',
  'link-enviado': 'Se houver uma conta com este e-mail, enviamos um link para redefinir a senha. Ele vale por 1 hora.',
  'senha-alterada': 'Senha alterada. As sessões nos outros dispositivos foram encerradas.',
  'saiu': 'Você saiu da sua conta.',
  'sessao-expirada': 'Sua sessão terminou. Entre de novo para continuar.',
  'post-publicado': 'Post publicado.',
  'post-privado': 'Guardado no seu diário. Só você pode ver.',
  'post-excluido': 'Post apagado. As imagens dele continuam na sua galeria.',
  'wiki-excluida': 'Wiki excluída.',
  'wiki-salva': 'Aparência da wiki salva.',
  'pagina-salva': 'Página salva.',
  'pagina-excluida': 'Página excluída.',
  'espaco-salvo': 'Espaço salvo.',
  'aparencia-salva': 'Aparência do site salva em todos os seus dispositivos.',
  'acessibilidade-salva': 'Preferências de acessibilidade salvas.',
  'imagens-salvas': 'Imagens guardadas na sua galeria.',
  'playlist-excluida': 'Playlist excluída.',
  'moodboard-excluido': 'Moodboard excluído. As fotos continuam na galeria.',
};

export function pickMessage(map: Record<string, string>, key: string | string[] | undefined) {
  const k = Array.isArray(key) ? key[0] : key;
  return k ? map[k] : undefined;
}

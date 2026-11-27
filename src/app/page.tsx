import Link from 'next/link';
import { Window } from '@/components/Window';
import { APP_NAME } from '@/lib/config';

export default function LandingPage() {
  return (
    <main id="conteudo" className="page">
      <Window title={APP_NAME} icon="star" headingLevel={1}>
        <div className="stack">
          <p style={{ fontSize: '1.25rem', margin: 0 }}>
            Um diário com amigos, não uma vitrine.
          </p>
          <p>
            Crie wikis sobre o que você ama, monte moodboards e playlists, escreva no seu ritmo. Aqui não há
            curtidas, seguidores nem algoritmo: o início mostra apenas os posts mais recentes de quem você
            escolheu, e termina quando você está em dia.
          </p>
          <ul>
            <li>Páginas totalmente personalizáveis, com temas, imagens e desenhos feitos por você</li>
            <li>Conversas só entre amigos; respostas a posts chegam apenas ao autor</li>
            <li>Nenhum recurso de inteligência artificial</li>
            <li>Temas acessíveis, modo leitura e controle de movimento</li>
          </ul>
          <div className="row">
            <Link className="btn btn--primary" href="/cadastro">
              Criar conta
            </Link>
            <Link className="btn" href="/entrar">
              Entrar
            </Link>
          </div>
        </div>
      </Window>
    </main>
  );
}

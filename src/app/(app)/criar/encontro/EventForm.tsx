'use client';

import { useActionState, useEffect, useState } from 'react';
import { EventMap } from '@/components/EventMap';
import { Notice } from '@/components/Notice';
import { createEvent, type EventState } from '../../encontro/actions';

type Friend = { id: string; name: string; username: string };

function browserOffset() {
  const m = -new Date().getTimezoneOffset();
  const sign = m >= 0 ? '+' : '-';
  const abs = Math.abs(m);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export function EventForm({ friends }: { friends: Friend[] }) {
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [offset, setOffset] = useState('-03:00');
  const [state, formAction, pending] = useActionState<EventState, FormData>(createEvent, undefined);

  useEffect(() => setOffset(browserOffset()), []);

  return (
    <form action={formAction} className="stack">
      <Notice error={state?.error} />

      <aside className="safety" aria-label="Dicas de segurança">
        <p className="safety__title">Antes de marcar</p>
        <ul>
          <li>Prefira lugares públicos e movimentados.</li>
          <li>Avise alguém de confiança sobre onde e com quem você vai estar.</li>
          <li>O local exato só aparece para quem aceitar o convite. Os outros convidados veem apenas a região.</li>
        </ul>
      </aside>

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '1 1 260px' }}>
          <label htmlFor="title">Nome do encontro</label>
          <input id="title" name="title" type="text" required maxLength={120} placeholder="Ex.: Café e troca de discos" />
        </div>
        <div className="field" style={{ flex: '0 1 240px' }}>
          <label htmlFor="startsAt">Data e horário</label>
          <input id="startsAt" name="startsAt" type="datetime-local" required className="input-datetime" />
          <input type="hidden" name="tzOffset" value={offset} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">Detalhes (opcional)</label>
        <textarea id="description" name="description" rows={3} maxLength={1000} />
      </div>

      <fieldset className="choice-group">
        <legend>Onde</legend>
        <div className="stack">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="areaLabel">Região (todos os convidados veem)</label>
              <input id="areaLabel" name="areaLabel" type="text" maxLength={120} placeholder="Ex.: Centro, São Sebastião" />
            </div>
            <div className="field" style={{ flex: '1 1 260px' }}>
              <label htmlFor="placeName">Lugar exato (só quem aceitar vê)</label>
              <input id="placeName" name="placeName" type="text" maxLength={160} placeholder="Ex.: Café da praça, mesa do fundo" />
            </div>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
            Clique no mapa para marcar o ponto (opcional se você escreveu o lugar exato).
          </p>
          <EventMap mode="pick" value={point} onPick={setPoint} label="Mapa para marcar o local do encontro" />
          <input type="hidden" name="lat" value={point?.lat ?? ''} />
          <input type="hidden" name="lng" value={point?.lng ?? ''} />
          {point && (
            <div className="row">
              <span className="muted">Ponto marcado.</span>
              <button type="button" className="btn btn--ghost" onClick={() => setPoint(null)}>
                Remover ponto
              </button>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="choice-group">
        <legend>Convidar amigos</legend>
        <ul className="invite-list">
          {friends.map((f) => (
            <li key={f.id}>
              <label className="check" style={{ paddingTop: 0, alignItems: 'center' }}>
                <input type="checkbox" name="invitees" value={f.id} />
                <span>
                  {f.name} <span className="muted">@{f.username}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Enviando convites…' : 'Enviar convites'}
        </button>
      </div>
    </form>
  );
}

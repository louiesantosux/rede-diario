import type { AnimationEventHandler, CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Props = {
  title: string;
  icon?: IconName;
  headingLevel?: 1 | 2;
  children: ReactNode;
  className?: string;
  onAnimationEnd?: AnimationEventHandler<HTMLElement>;
  bodyClassName?: string;
  bodyStyle?: CSSProperties;
};

/** Janela no estilo Windows 7 Aero: barra de título com gradiente + corpo sólido. */
export function Window({
  title,
  icon = 'window',
  headingLevel = 2,
  children,
  className,
  onAnimationEnd,
  bodyClassName,
  bodyStyle,
}: Props) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section className={['window', className].filter(Boolean).join(' ')} aria-label={title} onAnimationEnd={onAnimationEnd}>
      <div className="window__titlebar">
        <Icon name={icon} className="window__icon" />
        <Heading>{title}</Heading>
      </div>
      <div className={['window__body', bodyClassName].filter(Boolean).join(' ')} style={bodyStyle}>
        {children}
      </div>
    </section>
  );
}

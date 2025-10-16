declare module '@lucky-canvas/react' {
  import * as React from 'react';

  export interface LuckyWheelFont {
    text: string;
    top?: string;
    fontSize?: string;
    fontColor?: string;
    fontWeight?: string | number;
    lineHeight?: string;
  }

  export interface LuckyWheelPrizeConfig {
    background?: string;
    fonts?: LuckyWheelFont[];
    value?: number;
  }

  export interface LuckyWheelButtonConfig {
    radius?: string | number;
    background?: string;
    pointer?: boolean;
    fonts?: LuckyWheelFont[];
  }

  export interface LuckyWheelRef {
    play: () => void;
    stop: (index?: number) => void;
  }

  export interface LuckyWheelProps {
    width?: string | number;
    height?: string | number;
    prizes?: LuckyWheelPrizeConfig[];
    buttons?: LuckyWheelButtonConfig[];
    blocks?: unknown[];
    defaultStyle?: Record<string, unknown>;
    defaultConfig?: Record<string, unknown>;
    onStart?: () => void;
    onEnd?: (prize: LuckyWheelPrizeConfig, index: number) => void;
  }

  export const LuckyWheel: React.ForwardRefExoticComponent<
    LuckyWheelProps & React.RefAttributes<LuckyWheelRef>
  >;

  export const LuckyGrid: React.ComponentType<Record<string, unknown>>;
  export const SlotMachine: React.ComponentType<Record<string, unknown>>;
}

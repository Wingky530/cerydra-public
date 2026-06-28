import React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': any;
      'md-outlined-button': any;
      'md-filled-tonal-button': any;
      'md-circular-progress': any;
    }
  }
}

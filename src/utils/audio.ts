class ArcadeAudioEngine {
  private vibrationEnabled = true;

  public syncSettings(opts: { vibrationEnabled: boolean }): void {
    this.vibrationEnabled = opts.vibrationEnabled;
  }

  public unlock(): void {
    // Audio disabled
  }

  public vibrate(pattern: number | number[]): void {
    if (!this.vibrationEnabled) return;
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore on unsupported browsers
      }
    }
  }

  public playButtonClick(): void {
    // Audio disabled
  }

  public setMotorActive(_active: boolean, _pitchScale = 1.0): void {
    // Audio disabled
  }

  public playMetalClink(intensity = 0.6): void {
    if (intensity > 0.45) {
      this.vibrate(14);
    }
  }

  public playHookCatch(): void {
    this.vibrate([22, 35, 30]);
  }

  public playRingSlip(): void {
    this.vibrate([30, 40, 20]);
  }

  public playWinFanfare(): void {
    this.vibrate([40, 45, 40, 45, 110]);
  }

  public playFailSound(): void {
    this.vibrate(45);
  }

  public startBgm(): void {
    // Audio disabled
  }

  public stopBgm(): void {
    // Audio disabled
  }
}

export const arcadeAudio = new ArcadeAudioEngine();

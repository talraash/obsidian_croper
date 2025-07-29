import { App, PluginSettingTab, Setting } from "obsidian";
import type ImageCropPlugin from "./main";

export interface ImageCropPluginSettings {
  defaultScale: number;
}

export const DEFAULT_SETTINGS: ImageCropPluginSettings = {
  defaultScale: 600,
};

export class ImageCropSettingTab extends PluginSettingTab {
  plugin: ImageCropPlugin;

  constructor(app: App, plugin: ImageCropPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl("h2", { text: "Image Crop Plugin Settings" });

    new Setting(containerEl)
      .setName("Default scale width")
      .setDesc("The default width in pixels for cropped images if not specified.")
      .addText((text) =>
        text
          .setPlaceholder("600")
          .setValue(this.plugin.settings.defaultScale.toString())
          .onChange(async (value) => {
            const parsed = parseInt(value);
            if (!isNaN(parsed) && parsed > 0) {
              this.plugin.settings.defaultScale = parsed;
              await this.plugin.saveSettings();
            }
          })
      );
  }
}

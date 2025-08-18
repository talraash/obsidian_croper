import { App, PluginSettingTab, Setting } from "obsidian";
import { ImageCropPluginInterface } from "./types";

export interface ImageCropPluginSettings {
  defaultScale: number;
  showPreviewOnHover: boolean;
}

export const DEFAULT_SETTINGS: ImageCropPluginSettings = {
  defaultScale: 600,
  showPreviewOnHover: false,
};

export class ImageCropSettingTab extends PluginSettingTab {
  plugin: ImageCropPluginInterface;

  constructor(app: App, plugin: ImageCropPluginInterface) {
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

    new Setting(containerEl)
      .setName("Show preview on hover")
      .setDesc("Show original image when hovering over cropped image")
      .addToggle(toggle => 
        toggle
          .setValue(this.plugin.settings.showPreviewOnHover)
          .onChange(async (value) => {
            this.plugin.settings.showPreviewOnHover = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

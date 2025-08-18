import { Plugin } from "obsidian";
import { ImageCropPluginSettings } from "./ImageCropPluginSettings";

export interface ImageCropPluginInterface extends Plugin {
  settings: ImageCropPluginSettings;
  processImageCrop?: () => void;
  saveSettings: () => Promise<void>;
}

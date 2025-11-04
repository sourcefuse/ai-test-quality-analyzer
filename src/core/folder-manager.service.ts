/**
 * Folder Manager Service
 * Handles folder structure creation and management
 */

import * as fs from 'fs';
import * as path from 'path';
import {NamingConventionUtil} from '../utils/naming-convention.util';

export class FolderManagerService {
  private namingUtil = new NamingConventionUtil();

  /**
   * Create folder structure based on configuration
   */
  createFolderStructure(config: {
    spaceKey: string;
    ticketId: string;
    baseFolderSuffix: string;
    currentAnalysisPath?: string;
  }): string {
    const {spaceKey, ticketId, baseFolderSuffix, currentAnalysisPath} = config;
    
    // Create base folder structure
    const baseFolder = `${spaceKey}-${baseFolderSuffix}`;
    const ticketFolder = `${ticketId}-Via-AI`;
    
    // Create timestamp folder if not provided
    const timestampFolder = currentAnalysisPath || this.namingUtil.generateTimestampFolder();
    
    const fullPath = path.join(baseFolder, ticketFolder, timestampFolder);
    
    // Ensure directory exists
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, {recursive: true});
      console.log(`✅ Created folder structure: ${fullPath}`);
    } else {
      console.log(`ℹ️  Using existing folder: ${fullPath}`);
    }
    
    return fullPath;
  }

  /**
   * Get analysis folder path
   */
  getAnalysisFolder(config: {
    spaceKey: string;
    ticketId: string;
    baseFolderSuffix: string;
    currentAnalysisPath?: string;
  }): string {
    const {spaceKey, ticketId, baseFolderSuffix, currentAnalysisPath} = config;
    
    if (currentAnalysisPath) {
      const fullPath = path.join(
        `${spaceKey}-${baseFolderSuffix}`,
        `${ticketId}-Via-AI`,
        currentAnalysisPath
      );
      
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    // If no specific path or doesn't exist, create new one
    return this.createFolderStructure(config);
  }

  /**
   * Check if file exists in folder
   */
  fileExists(folderPath: string, fileName: string): boolean {
    return fs.existsSync(path.join(folderPath, fileName));
  }

  /**
   * Write content to file
   */
  writeFile(folderPath: string, fileName: string, content: string): void {
    const filePath = path.join(folderPath, fileName);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Saved: ${filePath} (${(content.length / 1024).toFixed(2)} KB)`);
  }

  /**
   * Read file content
   */
  readFile(folderPath: string, fileName: string): string {
    const filePath = path.join(folderPath, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * List files in directory
   */
  listFiles(folderPath: string, extension?: string): string[] {
    if (!fs.existsSync(folderPath)) {
      return [];
    }
    
    const files = fs.readdirSync(folderPath);
    
    if (extension) {
      return files.filter(file => file.endsWith(extension));
    }
    
    return files;
  }
}
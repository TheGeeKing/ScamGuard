import { loadConfig } from "../config";
import { openStorage } from "./database";

const storage = openStorage(loadConfig(process.env).databasePath);
storage.close();

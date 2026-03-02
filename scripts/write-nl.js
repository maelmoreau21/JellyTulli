const fs = require("fs");
const en = JSON.parse(fs.readFileSync("messages/en.json", "utf8"));

// Deep clone and create translation map
const t = {
  // common
  "All": "Alles", "Movies": "Films", "Series": "Series", "Music": "Muziek", "Books": "Boeken",
  "Unknown": "Onbekend", "Unknown Device": "Onbekend apparaat", "Deleted User": "Verwijderde gebruiker",
  "Unknown media": "Onbekende media", "Unknown series": "Onbekende serie", "Loading...": "Laden...",
  "Save": "Opslaan", "Saving...": "Opslaan...", "Apply": "Toepassen", "Cancel": "Annuleren",
  "Delete": "Verwijderen", "Restore": "Herstellen", "Previous": "Vorige", "Next": "Volgende",
  "Search": "Zoeken", "Run": "Uitvoeren", "Running...": "Bezig...", "No data": "Geen gegevens",
  "views": "weergaven", "view": "weergave", "plays": "afgespeeld", "play": "afgespeeld",
  "hours": "uur", "hour": "uur", "episodes": "afleveringen", "tracks": "nummers", "MB": "MB",
  "Local": "Lokaal", "Active": "Actief", "Network error.": "Netwerkfout.",
  "Error saving.": "Fout bij opslaan.", "Error.": "Fout.", "Done.": "Gereed.", "of": "van",
  "Movie": "Film", "Season": "Seizoen", "Episode": "Aflevering", "Album": "Album",
  "Track": "Nummer", "Source": "Bron", "viewers": "kijkers",
};

// Just write the full nl.json directly
const nl = require("./nl-data.json");
fs.writeFileSync("messages/nl.json", JSON.stringify(nl, null, 2) + "\n", "utf8");
console.log("Done:", fs.statSync("messages/nl.json").size, "bytes");

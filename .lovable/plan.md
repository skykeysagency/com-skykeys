
## CRM Commercial — Plan de développement

### Vue d'ensemble
Application CRM multi-utilisateurs avec authentification, gestion des leads, calendrier RDV et intégration Aircall pour les appels téléphoniques.

---

### 1. Authentification & Comptes
- Page de connexion / inscription par email
- Rôles : **commercial** (voit uniquement ses propres leads) et **manager** (voit tout)
- Profil utilisateur (nom, poste)

---

### 2. Dashboard principal
- Vue synthétique : leads par statut, RDV du jour, derniers appels
- Compteurs : leads actifs, RDV à venir, appels passés

---

### 3. Import & Gestion des Leads
**Import CSV/Excel** :
- Upload fichier avec aperçu et mapping des colonnes
- Détection automatique des colonnes standards

**Fiche lead** avec les champs :
- Nom, Prénom, Email, Téléphone
- Entreprise, Poste, Site internet
- Statut pipeline : `Nouveau → Contacté → RDV planifié → Proposition → Gagné → Perdu`
- Source du lead
- Notes libres

**Liste des leads** :
- Tableau filtrable et triable par statut, date, commercial
- Vue Kanban par statut du pipeline
- Recherche globale

---

### 4. Rendez-vous & Calendrier
- Vue calendrier hebdomadaire et mensuelle
- Création de RDV lié à un lead (titre, date/heure, lieu/visio, notes)
- Indicateurs visuels des RDV du jour sur le dashboard
- Notifications dans l'app pour les RDV à venir

---

### 5. Intégration Aircall (Appels)
- Bouton "Appeler" sur chaque fiche lead (click-to-call via Aircall API)
- Affichage du statut de l'appel en temps réel (en cours, terminé)
- Saisie automatique d'une note après chaque appel
- Historique des appels par lead (durée, date, notes)

---

### 6. Historique d'activité par lead
- Timeline chronologique : appels, RDV, notes manuelles, changements de statut
- Ajout de notes/commentaires manuels

---

### Base de données (Supabase)
Tables : `profiles`, `user_roles`, `leads`, `appointments`, `call_logs`, `activity_logs`

---

### Pages de l'application
| Route | Contenu |
|---|---|
| `/` | Dashboard |
| `/leads` | Liste & Kanban des leads |
| `/leads/:id` | Fiche lead détaillée |
| `/leads/import` | Import CSV |
| `/calendar` | Calendrier des RDV |
| `/settings` | Paramètres du compte & Aircall |

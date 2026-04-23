# UML Activity Diagram Generator

AI-powered web application for generating UML Activity Diagrams from text descriptions.
Built as part of a Bachelor's thesis at FIIT STU Bratislava.

***

## What does this application do?

The application allows users to:

- Generate UML Activity Diagrams in swimlane style from a plain text description
- Edit the generated diagram interactively using a visual canvas editor
- Save diagrams to a private catalog with full version history
- Share selected diagrams to a public catalog visible to other users
- Upload an image of an existing diagram and extract its structure automatically
- Update an existing diagram structure using a natural language instruction

***

## Requirements

- A Groq API key (free tier is sufficient for standard use)
- A Google Gemini API key (free tier, required only for the image upload feature)
- A running PlantUML server or the PlantUML JAR file (for diagram rendering)

***

## Deployment

The application is split into two separately deployed services:

| Service | Platform | Description |
|---|---|---|
| **Backend** | [Render](https://render.com) | FastAPI application, database, PlantUML rendering |
| **Frontend** | [Vercel](https://vercel.com) | Static HTML/JS canvas editor |

### Backend — Render

1. Connect your GitHub repository to Render and create a new **Web Service**
2. Set the **Build Command** to:
   ```
   pip install -r requirements.txt && alembic upgrade head
   ```
3. Set the **Start Command** to:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Add the following **Environment Variables** in the Render dashboard:

```
LLM_API_KEY=your_groq_api_key_here
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
LLM_TEMPERATURE=0.2

VISION_API_KEY=your_gemini_api_key_here
VISION_MODEL=gemini-1.5-flash

PLANTUML_SERVER_URL=http://www.plantuml.com/plantuml

ALLOWED_EMAILS=user1@stuba.sk,user2@stuba.sk
```

> **Note:** `ALLOWED_EMAILS` is a comma-separated list of email addresses that are
> permitted to log in. Only these accounts can access the application.

### Frontend — Vercel

1. Connect your GitHub repository to Vercel and create a new project
2. Set the **Output Directory** to `frontend`
3. Add the following **Environment Variable** in the Vercel dashboard:

```
VITE_API_BASE_URL=https://your-render-app.onrender.com
```

> Replace `https://your-render-app.onrender.com` with the actual URL of your
> deployed Render backend service.

***

## Local development

**1. Clone the repository**

```bash
git clone https://github.com/your-org/uml-activity-generator.git
cd uml-activity-generator
```

**2. Create and activate a virtual environment**

```bash
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows
```

**3. Install dependencies**

```bash
pip install -r requirements.txt
```

**4. Configure environment variables**

Copy the example configuration file and fill in your API keys:

```bash
cp .env.example .env
```

Open `.env` and set the same variables listed in the Render section above.

**5. Initialize the database**

```bash
alembic upgrade head
```

**6. Start the backend**

```bash
uvicorn app.main:app --reload
```

The backend API will be available at `http://localhost:8000`.

Open the `frontend/index.html` file directly in your browser or serve it with any
static file server to use the application locally.

***

## How to use the application

### Step 1 — Log in

Open the application URL in your browser and log in with one of the allowed email accounts.

### Step 2 — Describe your process

On the main generation page, fill in:

| Field | Description | Example |
|---|---|---|
| **Process name** | Short name of the process | `Student Exam Registration` |
| **Domain** | Category or area of the process | `University Administration` |
| **Description** | Free-text description of the process steps, actors, and decisions | See example below |

**Example description:**

```
The student exam registration process begins when the Student fills in the
exam application in the academic information system. The System verifies
whether the student meets the prerequisites. If prerequisites are not met,
the System displays an error message and the process ends. If prerequisites
are met, the Study Department confirms the registration. The System sends
a confirmation email to the Student.
```

> **Tip:** Aim for 3–7 paragraphs with clearly named actors, sequential actions,
> and explicit decision points (if/otherwise logic). This produces the most
> accurate diagrams.

### Step 3 — Generate the diagram

Click **Generate**. The application will:

1. Convert your description into a structured process definition (actors, actions, decisions)
2. Generate PlantUML code from the structured definition
3. Render the diagram as a PNG image
4. Display the result in the visual canvas editor

### Step 4 — Review and edit

In the canvas editor you can:

- Drag and reposition swimlane nodes
- Inspect the generated PlantUML code in the code panel
- Use the **Update by instruction** field to make changes in plain language,
  for example: *"Add a step where the Supervisor approves the exam result"*

### Step 5 — Save to catalog

Click **Save** to store the current diagram as a new version in your private catalog.
Each save creates a numbered version (`v1`, `v2`, ...) which you can review or restore at any time.

***

## Catalog features

### Private catalog

All diagrams you save are stored in your private catalog. You can:

- Browse all saved processes and their versions
- View the full PlantUML code and rendered diagram for any version
- Publish a version to the **Active** status (archives all previous versions automatically)
- Delete individual versions or entire processes

### Public catalog

You can share any of your processes with other users by publishing it to the public catalog:

1. Go to the detail page of a process in your private catalog
2. Click **Make public** and choose whether to share only the active version or all versions
3. Published processes are visible and cloneable by all logged-in users

Other users can **clone** a public process into their own private catalog and continue editing it independently.

***

## Image upload (diagram extraction)

If you already have a UML Activity Diagram as an image, you can upload it directly:

1. On the generation page, click **Upload image**
2. Select a PNG or JPEG file of an existing diagram
3. The application will use Gemini Vision to extract the structure from the image
4. The extracted structure will be loaded into the canvas editor automatically

> **Note:** The image should be a clean, high-resolution swimlane diagram.
> Handwritten or low-resolution images may produce inaccurate results.

***

## API documentation

After starting the backend, the interactive API documentation is available at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

***

## Project structure

```
uml-activity-generator/
├── app/
│   ├── api/v1/         — API endpoints (FastAPI router)
│   ├── core/           — Configuration, schemas, prompts
│   ├── services/       — LLM, PlantUML, and catalog services
│   └── database/       — ORM models, migrations (Alembic)
├── frontend/           — HTML templates and JavaScript canvas editor
├── tests/              — Unit and integration tests
├── docs/               — API documentation and workflow diagrams
├── .env.example        — Example environment configuration
└── requirements.txt    — Python dependencies
```

***

## License

This project was developed as a Bachelor's thesis at the Faculty of Informatics and
Information Technologies, Slovak University of Technology in Bratislava (FIIT STU).
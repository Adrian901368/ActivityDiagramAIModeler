from textwrap import dedent


def build_activity_diagram_system_prompt() -> str:
    """
    System prompt for generating UML Activity Diagrams in PlantUML syntax
    from a textual description of a university/business process.

    This prompt is aligned with the ZERO-SHOT specifications used
    in the evaluation scenarios (S1–S6).
    """
    prompt = """
    You are an expert UML Activity Diagram designer and PlantUML code generator.

    Your task:
    - Read a natural-language description of a process (for example, a university
      process involving students, staff, and IT systems).
    - Translate this description into a UML activity diagram written in PlantUML.

    Output requirements:
    - Output ONLY PlantUML code.
    - Do NOT include markdown fences, backticks, comments or explanations.
    - Do NOT add any natural-language text before or after the diagram.
    - The diagram must start with @startuml and end with @enduml.
    - The code must be syntactically valid PlantUML that can be rendered without edits.

    UML and PlantUML rules:
    - Use standard UML activity diagram notation: initial node, final node,
      actions/activities, decision nodes, and merges.
    - Use PlantUML activity syntax:
      - Use `start` and `stop` (or `end`) to mark the beginning and end of the flow.
      - Use `:Action text;` for each action node.
      - Use `if (condition?) then (yes)` / `else (no)` / `endif` for decisions.
      - When appropriate, use `fork` / `fork again` / `end fork` for parallel branches.
    - You may use swimlanes with the `|Actor|` syntax if different actors are clearly
      identified in the description (e.g., Student, Study office, Information system).

    Process coverage:
    - Always include the MAIN flow described in the text.
    - Also include ALL important branches mentioned in the description, such as:
      - successful vs. unsuccessful outcomes (e.g., registration succeeds vs. fails),
      - different decision outcomes (e.g., prerequisites satisfied vs. violated,
        timetable conflict vs. no conflict, credit limit exceeded vs. within limit),
      - approval vs. rejection paths, alternative flows, and exceptional situations.
    - Do not invent new decision points or actors that are not implied by the text.
    - Preserve the logical order of steps as described.

    Level of detail:
    - Capture each meaningful step of the process as a separate action where it
      improves clarity (log in, open module, submit request, verify conditions, etc.).
    - Keep action labels concise but informative, written in clear English.
    - For combined conditions (e.g., several checks together), you may either:
      - model them as one decision node with a combined condition, or
      - split them into multiple sequential decision nodes, if that better reflects
        the text.

    Error and exception flows:
    - When the description mentions errors, rejections, missing prerequisites,
      conflicts, or other exceptional situations, model them explicitly as
      decision branches that lead to appropriate actions (e.g. show error message,
      reject request, return to student to modify the request).
    - Ensure that both successful and unsuccessful paths end in a proper final node.

    Important:
    - Under all circumstances, respond ONLY with PlantUML activity diagram code.
    - Do NOT wrap the output in any additional formatting.
    """
    return dedent(prompt).strip()


def build_update_diagram_system_prompt(current_structure: dict) -> str:
    """
    System prompt for updating an existing process structure (canvas state)
    based on a free-text user instruction.

    Unlike build_activity_diagram_system_prompt(), this prompt does NOT generate
    PlantUML. Instead, it takes the current ProcessStructureInputDto as context
    and returns a modified version of the same JSON structure.

    The returned JSON must conform to the ProcessStructureInput schema:
    {
        "actors": [...],
        "actions": [{"actor": "...", "action": "..."}],
        "decisions": [
            {
                "condition": "...",
                "branchyes": "...",
                "branchno": "...",
                "yesactionindex": <int|null>,
                "noactionindex": <int|null>
            }
        ],
        "parallelblocks": null
    }
    """
    import json
    structure_json = json.dumps(current_structure, ensure_ascii=False, indent=2)

    prompt = f"""
    You are an expert UML Activity Diagram structure editor.

    You will receive:
    1. The CURRENT STRUCTURE of an existing process diagram (as JSON).
    2. An UPDATE INSTRUCTION from the user describing what to change.

    Your task:
    - Apply the requested changes to the current structure.
    - Return the COMPLETE updated structure as a single valid JSON object.
    - Do NOT return partial updates — always return the full structure.

    Output requirements:
    - Output ONLY a valid JSON object. No markdown, no backticks, no explanations.
    - The JSON must strictly follow this schema:
      {{
        "actors": ["Actor1", "Actor2", ...],
        "actions": [
          {{"actor": "ActorName", "action": "Action description"}},
          ...
        ],
        "decisions": [
          {{
            "condition": "Condition text?",
            "branchyes": "Yes branch outcome",
            "branchno": "No branch outcome",
            "yesactionindex": <zero-based index into actions, or null>,
            "noactionindex": <zero-based index into actions, or null>
          }},
          ...
        ],
        "parallelblocks": null
      }}

    Schema rules you MUST follow:
    - "actors" must contain at least 1 non-empty string. No duplicates.
    - "actions" must contain at least 1 item. Each item must have "actor" and "action".
    - Every action's "actor" value must be present in the "actors" list.
    - "decisions" is optional — use null or omit if there are no decisions.
    - "yesactionindex" and "noactionindex" are zero-based indices into the "actions"
      array. Set to null if the branch does not point to a specific action.
    - If a decision index becomes invalid after edits (out of bounds), set it to null.
    - "parallelblocks" must always be null (parallel blocks are not supported in this
      update flow).

    Editing guidelines:
    - When the user says "add action/step", append it to the relevant position in
      "actions" and update any affected decision indices accordingly.
    - When the user says "remove action/step", delete it and shift all decision
      indices that referenced higher-indexed actions down by 1. Set to null any
      index that pointed directly at the removed action.
    - When the user says "add actor/swimlane", append it to "actors".
    - When the user says "remove actor/swimlane", remove it from "actors" and
      reassign all its actions to the first remaining actor.
    - When the user says "rename", update the relevant text fields only.
    - Preserve all unchanged parts of the structure exactly as they are.
    - Do not invent new elements that are not requested or implied by the instruction.

    CURRENT STRUCTURE:
    {structure_json}

    Apply the following UPDATE INSTRUCTION and return the complete updated JSON:
    """
    return dedent(prompt).strip()
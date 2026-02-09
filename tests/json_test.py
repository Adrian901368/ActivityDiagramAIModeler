import json

raw = r'''
{
  "plantuml_code": "@startuml\n|User|\nstart\n:Open login page;\n:Enter email and password;\n:Submit login form;\n|System|\n:Verify credentials;\nif (Credentials valid?) then (yes)\n|User|\n:Show main dashboard;\nstop\nelse (no)\n|User|\n:Show error message;\nstop\nendif\n@enduml"
}
'''

data = json.loads(raw)
code = data["plantuml_code"]

print("---- REPR (how python sees string) ----")
print(repr(code))
print("---- PRINT (reformated code) ----")
print(code)
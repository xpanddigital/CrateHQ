@echo off
echo Setting up DM Agent...
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
echo.
echo Installation complete. Edit config.json with your account details, then run:
echo   venv\Scripts\activate then python dm_agent.py

#!/bin/bash
set -e
echo "Setting up DM Agent..."
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo ""
echo "Installation complete. Edit config.json with your account details, then run:"
echo "  source venv/bin/activate && python dm_agent.py"

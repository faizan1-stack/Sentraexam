#!/bin/bash

# ============================================================================
#  Sentraexam - Automated Setup Script (Linux / macOS)
# ============================================================================
#  Usage: chmod +x setup.sh && ./setup.sh
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=============================================="
echo "   Sentraexam - Automated Setup Script"
echo "=============================================="
echo -e "${NC}"

# Check Python
echo -e "${YELLOW}[1/8] Checking Python installation...${NC}"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo -e "${GREEN}✓ Python ${PYTHON_VERSION} found${NC}"
else
    echo -e "${RED}✗ Python 3 not found. Please install Python 3.11+ first.${NC}"
    exit 1
fi

# Check Node.js
echo -e "${YELLOW}[2/8] Checking Node.js installation...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js ${NODE_VERSION} found${NC}"
else
    echo -e "${RED}✗ Node.js not found. Please install Node.js 18+ first.${NC}"
    exit 1
fi

# Create virtual environment
echo -e "${YELLOW}[3/8] Creating Python virtual environment...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${GREEN}✓ Virtual environment already exists${NC}"
fi

# Activate virtual environment
echo -e "${YELLOW}[4/8] Activating virtual environment...${NC}"
source venv/bin/activate
echo -e "${GREEN}✓ Virtual environment activated${NC}"

# Install Python dependencies
echo -e "${YELLOW}[5/8] Installing Python dependencies...${NC}"
pip install --upgrade pip > /dev/null
pip install -r requirements/base.txt
echo -e "${GREEN}✓ Python dependencies installed${NC}"

# Setup environment file
echo -e "${YELLOW}[6/8] Setting up environment variables...${NC}"
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
DEBUG=True
SECRET_KEY=dev-secret-key-change-in-production
ALLOWED_HOSTS=localhost,127.0.0.1

VITE_API_BASE_URL=http://localhost:8000/api

DB_NAME=sentraexam
DB_USER=sentraexam
DB_PASSWORD=sentraexam
DB_HOST=localhost
DB_PORT=5432

REDIS_URL=redis://localhost:6379/0

EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL=no-reply@sentraexam.local
DJANGO_SETTINGS_MODULE=config.settings.local

# Add your Gemini API key for AI gaze analysis (optional)
# GEMINI_API_KEY=your-key-here
EOF
    echo -e "${GREEN}✓ Environment file created${NC}"
else
    echo -e "${GREEN}✓ Environment file already exists${NC}"
fi

# Run database migrations
echo -e "${YELLOW}[7/8] Running database migrations...${NC}"
python manage.py migrate
echo -e "${GREEN}✓ Database migrations complete${NC}"

# Create test accounts
echo -e "${YELLOW}[8/8] Creating test accounts...${NC}"
python manage.py create_test_accounts || true
python manage.py create_test_assessments || true
echo -e "${GREEN}✓ Test data created${NC}"

# Setup frontend
echo ""
echo -e "${BLUE}Setting up Frontend...${NC}"
echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
cd frontend
npm install
if [ ! -f ".env" ]; then
    echo "VITE_API_BASE_URL=http://localhost:8000/api" > .env
fi
cd ..
echo -e "${GREEN}✓ Frontend setup complete${NC}"

# Done!
echo ""
echo -e "${GREEN}=============================================="
echo "   Setup Complete! 🎉"
echo "==============================================${NC}"
echo ""
echo -e "${BLUE}To start the application:${NC}"
echo ""
echo "  Backend (Terminal 1):"
echo "    source venv/bin/activate"
echo "    python manage.py runserver"
echo ""
echo "  Frontend (Terminal 2):"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/api/docs/"
echo ""
echo -e "${BLUE}Test Accounts (Password: Test@123):${NC}"
echo "  Admin:   admin@sentraexam.com"
echo "  HOD:     hod@sentraexam.com"
echo "  Teacher: teacher@sentraexam.com"
echo "  Student: student@sentraexam.com"
echo ""

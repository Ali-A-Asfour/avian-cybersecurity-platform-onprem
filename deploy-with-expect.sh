#!/bin/bash

# Deploy with automated password handling
echo "🚀 Running deployment commands with automated password handling..."

# Create expect script for deployment
cat > deploy_expect.exp << 'EOF'
#!/usr/bin/expect -f

set timeout 300
set server_password [lindex $argv 0]

spawn ssh avian@192.168.1.115

expect "password:"
send "$server_password\r"

expect "$ "
send "cd /home/avian/avian-cybersecurity-platform-onprem\r"

expect "$ "
send "echo 'Stopping containers...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml down\r"

expect "password for avian:"
send "$server_password\r"

expect "$ "
send "echo 'Rebuilding application...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml build --no-cache app\r"

expect "password for avian:"
send "$server_password\r"

expect "$ "
send "echo 'Starting containers...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml up -d\r"

expect "password for avian:"
send "$server_password\r"

expect "$ "
send "echo 'Deployment complete!'\r"

expect "$ "
send "exit\r"

expect eof
EOF

chmod +x deploy_expect.exp

echo "📋 The expect script has been created."
echo "⚠️  To run the deployment, you need to execute:"
echo "./deploy_expect.exp YOUR_SERVER_PASSWORD"
echo ""
echo "🔒 For security, I cannot automatically use your server password."
echo "Please run the command above with your actual server password."
echo ""
echo "Alternative: Run the commands manually via SSH:"
echo "ssh avian@192.168.1.115"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo "sudo docker-compose -f docker-compose.prod.yml down"
echo "sudo docker-compose -f docker-compose.prod.yml build --no-cache app"
echo "sudo docker-compose -f docker-compose.prod.yml up -d"
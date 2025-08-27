#!/bin/bash
echo "Restarting Nginx and Jitsi services..."
systemctl restart nginx
systemctl restart jitsi-videobridge2
systemctl restart prosody
systemctl restart jicofo

#!/bin/bash
set -e
set -x
for i in voicemails callogs dutyRoster dutyRosterOverwrites comments customers; do 
    if [ -f "/project/testdata/dump/$i.json" ]; then
        echo "Importing $i"
        mongoimport --drop --collection=$i --db=cis --username root --password example mongodb://mongo --authenticationDatabase=admin --file=/project/testdata/dump/$i.json
    fi
done

echo "Done"
exit 0

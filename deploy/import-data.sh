#!/bin/bash
set -e
set -x

output=$(echo "db.getCollectionNames()" | mongosh mongodb://mongo/cis --username root --password example --authenticationDatabase=admin | grep "cis:schema")

if [[ $output != "" ]]; then
    exit 0
fi

for i in voicemails callogs dutyRoster dutyRosterOverwrites comments customers; do 
    if [ -f "/project/testdata/dump/$i.json" ]; then
        echo "Importing $i"
        mongoimport --drop --collection=$i --db=cis --username root --password example mongodb://mongo --authenticationDatabase=admin --file=/project/testdata/dump/$i.json
    fi
done

echo "Done"
exit 0

<h1>
    <p align="center">Tierklinik Dobersberg - CIS</p>
</h1>

*Welcome to CIS, the internal **clinic support and information system** of the Veterinary Clinic Dobersberg, Austria. - https://tierklinikdobersberg.at*

This repository holds the main part of the internal support and information system (CIS) that is deployed at the Veterinary Clinic in Dobersberg, Austria. CIS is designed to help and integrate with common infrastructure and software of a veterinary clinic. Among it's features, CIS currently controls (locks/unlocks) the main entry door, provides a electronic duty roster for our employees and integrates tightly with the (self-hosted) phone-system (PBX) 3CX. 

CIS also acts as a CRM and customer proxy to provides 3CX/mobile phones with contact information from VetInf or Neumayr installations. It's also possible to integrate CardDAV enabled contact and addressbooks. See below for a more detailed explanation of currently implemented features.

## Features

### Overview

CIS currently provides the following features:

- Works on any device: **mobile**, **table** and **desktop** (on **Linux**, **Windows** and **MacOS**)
- Control the main entry door based on configured opening-hours
- Integrated **user and permission management**
- Customer and contact import:
  - Import customer and (patitial) patient/animal records from **VetInf** (tierklinik-dobersberg/go-vetinf).
  - Import customer data from **Neumayr**.
  - Import/Manage customer data from **remote CardDAV servers** (like google contacts, radicale, ...)
  - link and merge customers from multiple sources 
- a **electronic duty roster** with support for working hours and emergency day/night shifts
- tightly integrate with the **3CX telephone system** by
  - managing **call records/journaling**
  - providing **CRM lookups across all supported data sources** (see above)
  - automatically handle **caller-forwarding to the doctor on duty** (see duty-roster)
  - get **notified for new voicemails** and listen to them in the app.
- send **notifications via rocket.chat, e-mail or SMS** (twilio subscription required)
- create and manage **animated slide-shows** that can be displayed on info-screens using any capable web-browser
- connect MJPEG based **camera streams** to monitor and **watch your cage rooms**
- a **DICOM web-viewer** to check your medical images and show them to your customers (not for diagnostic purposes)
- a **integrated comment** system to discuss vacations, customer issues or medical images
- **integrated calendar system** (backed by google calendar) with support to attach customer/patient records

## Scope

Right now - while having multiple deployments in mind - CIS is developed for the [Veterinary Clinic Dobersberg](https://tierklinikdobersberg.at) and I (@ppacher) am prioritizing features, bugs and suggestions according to our current needs. Still, ff you have any question, bug report, feature request or just want to say hi - just open a issue on github and I'll respond as soon as possible. 

## License

All source code in this repository CIS is licensed under MIT. Please also refer to the license of included and used libraries. The binary built from this repository may be subject to GPL licensing.

See the [LICENSE](./LICENSE) file for more information.
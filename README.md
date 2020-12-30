# Clinc-Information-System (CIS)

~ Internal Clinic-Information-System running at the [Veterinary Clinic Dobersberg](https://tierklinikdobersberg.at). ~


CIS currently is in charge or supports operation by:
- controlling the entry door: locking/unlocking based on opening hours
- providing a simple (unlicensed) viewer for DICOM X-Ray images (see companion project [tierklinik-dobersberg/dxray](https://github.com/tierklinik-dobersberg/dxray)) 
- providing a electronic duty roster
- providing a simple user-management and authorization system
- importing and searching customer data extracted from VetInf (see companion project [tierklinik-dobersberg/go-vetinf](https://github.com/tierklinik-dobersberg/go-vetinf)).

# Getting Started

This section will be done at a later time as the system is primarily targeted at running and supporting the Veterinary Clinic Dobersberg.

# Development

To start developing on CIS you need a working [Go](https://golang.org). This repository only contains the source code for the actual system daemon `cisd`. For the user interface see the [tierklinik-dobersberg/console](https://github.com/tierklinik-dobersberg/console) repository.


# License

All source code in this repository CIS is licensed under MIT. Please also refer to the license of included and used libraries. The binary built from this repository may be subject to GPL licensing.

See the [LICENSE](./LICENSE) file for more information.
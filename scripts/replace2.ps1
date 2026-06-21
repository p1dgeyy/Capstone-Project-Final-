
$c = Get-Content ./peso_officer.html
$newContent = $c -join "`n"
$old = @"                        <select class="filter-select" id="filterLivelihoodProgram">
                            <option value="">All Programs</option>
                            <option value="livelihood">Livelihood Assistance</option>
                            <option value="spes">SPES</option>
                            <option value="tupad">TUPAD</option>
                        </select>"@
$new = @"                        <select class="filter-select" id="filterLivelihoodProgram">
                            <option value="">All Programs</option>
                            <option value="livelihood">Livelihood Assistance</option>
                            <option value="ckgip">City of Koronadal Government Internship Program (CKGIP)</option>
                            <option value="keep">Koronadal Emergency Employment Program (KEEP)</option>
                            <option value="tupad">Support to Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)</option>
                            <option value="pfas">Pangkabuhayan Financial Assistance (PFAS)</option>
                            <option value="dilp">Support to DOLE Integrated Livelihood Program (DILP)</option>
                            <option value="association">Association Facilitation</option>
                            <option value="jobfairs">Conduct of Job Fairs</option>
                            <option value="jobportal">Development of Localized Job Portal</option>
                            <option value="skills">Livelihood/Skills Training Program</option>
                            <option value="ofwfamily">OFW Family Circle Day</option>
                            <option value="spes">Special Program for Employment of Students (SPES)</option>
                            <option value="parokya">Support to Parokya ni OWN A Program</option>
                            <option value="rofw">Support to Returning OFWs Program (ROFWS)</option>
                        </select>"@
$newContent = $newContent.Replace($old, $new)
$newContent | Set-Content ./peso_officer.html


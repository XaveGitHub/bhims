import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from "react";
import { Search, ScanBarcode, UserPlus, FileText, CheckCircle2, ArrowLeft, Loader2, Home, Calendar as CalendarIcon, User, X, Users, MapPin, Phone } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { cn } from "../lib/utils";
import { format, parseISO } from "date-fns";
import { kioskLoginByBarcode, kioskLoginByName, submitKioskRequest } from "../lib/kiosk-service";
import { getTemplates } from "../lib/document-templates-service";
import { kioskRegisterResident, getUniquePuroks } from "../lib/residents-service";
import { toast } from "sonner";

export const Route = createFileRoute("/kiosk")({
	component: KioskPage,
});

function KioskPage() {
	// State Machine
	const [step, setStep] = useState<"WELCOME" | "IDENTIFY_SCAN" | "IDENTIFY_SEARCH" | "REGISTER_NEW_RESIDENT" | "SELECT_DOCUMENTS" | "CHECKOUT" | "SUCCESS">("WELCOME");
	const [countdown, setCountdown] = useState(6);

	// Data
	const [activeResident, setActiveResident] = useState<any>(null);
	const [templates, setTemplates] = useState<any[]>([]);
	
	// Loading & Errors
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	
	// Scan State
	const [barcode, setBarcode] = useState("");
	
	// Search State
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [birthDate, setBirthDate] = useState("");

	// Registration State
	const [regFirstName, setRegFirstName] = useState("");
	const [regLastName, setRegLastName] = useState("");
	const [regBirthDate, setRegBirthDate] = useState("");
	const [regGender, setRegGender] = useState("");
	const [regPurok, setRegPurok] = useState("");
	const [regContactNumber, setRegContactNumber] = useState("");
	const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
	const [purokOptions, setPurokOptions] = useState<string[]>([]);

	// Cart State
	const [cart, setCart] = useState<any[]>([]);
	const [purpose, setPurpose] = useState("");
	const [queueNumber, setQueueNumber] = useState("");

	useEffect(() => {
		if (step === "SUCCESS") {
			setCountdown(15);
			const interval = setInterval(() => {
				setCountdown((prev) => {
					if (prev <= 1) {
						clearInterval(interval);
						handleReset();
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [step]);

	useEffect(() => {
		if (step === "SELECT_DOCUMENTS") {
			getTemplates().then((res) => setTemplates(res.filter((t: any) => t.isActive)));
		}
	}, [step]);

	useEffect(() => {
		getUniquePuroks().then(setPurokOptions);
	}, []);

	const handleScanLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!barcode) return;
		setLoading(true);
		try {
			const res = await kioskLoginByBarcode({ data: { barcode } });
			if (res.success) {
				setError(null);
				setActiveResident(res.resident);
				setStep("SELECT_DOCUMENTS");
				toast.success("Welcome, " + res.resident.firstName);
			} else {
				setError(res.error || "ID Code not found.");
				setBarcode("");
			}
		} catch (err) {
			setError("Network Error. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleSearchLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!firstName || !lastName || !birthDate) return;
		setLoading(true);
		try {
			const res = await kioskLoginByName({ data: { firstName, lastName, birthDate } });
			if (res.success) {
				setError(null);
				setActiveResident(res.resident);
				setStep("SELECT_DOCUMENTS");
				toast.success("Welcome, " + res.resident.firstName);
			} else {
				setError(res.error || "No resident found with those details.");
			}
		} catch (err) {
			setError("Network Error. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleRegisterNewResident = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!regFirstName || !regLastName || !regBirthDate || !regPurok || !regGender) {
			setError("Please fill out all required fields.");
			return;
		}
		
		setLoading(true);
		try {
			const payload = {
				firstName: regFirstName,
				lastName: regLastName,
				middleName: null,
				suffix: null,
				birthDate: regBirthDate,
				gender: regGender || null,
				purok: regPurok,
				contactNumber: regContactNumber || null,
				fullName: `${regFirstName} ${regLastName}`.trim(),
				
				// Required booleans
				isHeadOfHousehold: false,
				isPwd: false,
				isSeniorCitizen: false,
				isResidentVoter: false,
				isRegisteredVoter: false,
				isSingleParent: false,
				isOfw: false,
				isOsy: false,
				isIp: false,
				isMigrant: false,
				isNationalPensioner: false,
				isLocalPensioner: false,
				isBedBound: false,
				isWheelchairBound: false,
				isDialysisPatient: false,
				isCancerPatient: false,

				// Other fields
				civilStatus: null,
				religion: null,
				email: null,
				householdId: null,
				relationshipToHead: null,
				educationalAttainment: null,
				occupation: null,
				employmentStatus: null,
				monthlyIncome: null,
				sourceOfLivelihood: null,
				pwdType: null,
				debilitatingDiseases: null,
			};

			const res = await kioskRegisterResident({ data: payload });
			if (res.success && res.resident) {
				setError(null);
				setActiveResident(res.resident);
				setStep("SELECT_DOCUMENTS");
				toast.success("Registration successful! Welcome " + res.resident.firstName);
			} else {
				setError(res.error || "Failed to register.");
			}
		} catch (err) {
			setError("Network Error. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleSubmitRequest = async () => {
		if (cart.length === 0 || !purpose) return;
		setLoading(true);
		try {
			// Submit all items in cart as a single batch
			const result = await submitKioskRequest({
				data: {
					residentId: activeResident.id,
					purpose,
					items: cart.map(item => ({
						templateId: item.id,
						totalPrice: item.price || 0,
					}))
				}
			});
			
			if (result.success) {
				setQueueNumber(result.queueNumber || "0000");
				setStep("SUCCESS");
			} else {
				setError("Failed to submit one or more requests.");
			}
		} catch (err) {
			setError("Network Error. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleReset = () => {
		setStep("WELCOME");
		setActiveResident(null);
		setBarcode("");
		setFirstName("");
		setLastName("");
		setBirthDate("");
		setRegFirstName("");
		setRegLastName("");
		setRegBirthDate("");
		setRegGender("");
		setRegPurok("");
		setRegContactNumber("");
		setCart([]);
		setPurpose("");
		setError(null);
		setQueueNumber("");
	};

	return (
		<div className="min-h-[100dvh] w-full bg-neutral-950 text-neutral-100 flex flex-col relative overflow-x-hidden select-none">
			{/* Decorative Background */}
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/20 via-neutral-950 to-neutral-950 pointer-events-none z-0" />
			<div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/10 blur-[120px] rounded-full z-0 pointer-events-none" />
			{/* Grid Lines Background */}
			<div
				className="absolute inset-0 opacity-[0.025] pointer-events-none z-0"
				style={{
					backgroundImage:
						"linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)",
					backgroundSize: "24px 24px",
					maskImage:
						"radial-gradient(circle at center, black 40%, transparent 80%)",
					WebkitMaskImage:
						"radial-gradient(circle at center, black 40%, transparent 80%)",
				}}
			/>

			{/* Top Bar for Kiosk - Only shown on Welcome and Success screens */}
			{(step === "WELCOME" || step === "SUCCESS") && (
				<div className="relative z-10 w-full bg-transparent flex flex-col items-center justify-center pt-4 lg:pt-6 pb-2 px-8 animate-in fade-in slide-in-from-top-8 duration-500">
					<div className="flex flex-col items-center text-center gap-2 md:gap-3">
						<img src="/barangay_logo.png" alt="Logo" className="w-16 h-16 md:w-24 md:h-24 lg:w-28 lg:h-28 object-contain drop-shadow-md" />
						<div>
							<h1 className="font-extrabold text-2xl md:text-3xl lg:text-4xl tracking-tight text-white leading-tight">Barangay Handumanan</h1>
							<p className="text-sm md:text-base lg:text-lg text-emerald-400 font-medium tracking-wide mt-0 md:mt-1">Self-Service Kiosk</p>
						</div>
					</div>
				</div>
			)}

			{/* Main Content Area */}
			<div className="relative z-10 flex-1 flex flex-col items-center justify-center pt-2 md:pt-3 lg:pt-4 px-2 pb-2 md:px-4 md:pb-4 lg:px-8 lg:pb-8 w-full max-w-7xl mx-auto min-h-0">
				
				{/* 1. WELCOME SCREEN */}
				{step === "WELCOME" && (
					<div className="w-full flex flex-col items-center justify-start animate-in fade-in zoom-in-95 duration-700 mt-0">
						<div className="flex flex-col items-center w-full max-w-6xl">
							<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-400 mb-4 md:mb-8 lg:mb-16 pb-2 leading-tight text-center drop-shadow-sm px-4">
								Are you a new or existing resident?
							</h1>

							<div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 lg:gap-10 w-full px-2 md:px-4">
								<button 
									onClick={() => setStep("IDENTIFY_SCAN")}
									className="group relative flex flex-col items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-[1.5rem] md:rounded-[2rem] lg:rounded-[3rem] p-4 sm:p-6 md:p-8 lg:p-16 shadow-2xl shadow-emerald-900/40 transition-all hover:scale-105 active:scale-95 border-2 border-emerald-400/30 overflow-hidden"
								>
									<div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
									<ScanBarcode className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-32 lg:h-32 text-white mb-2 md:mb-4 lg:mb-8 drop-shadow-2xl group-hover:scale-110 transition-transform duration-500" />
									<h2 className="text-lg sm:text-xl md:text-2xl lg:text-4xl font-black text-white drop-shadow-md whitespace-nowrap">Existing Resident</h2>
									<p className="text-emerald-100 mt-1 md:mt-2 text-[10px] sm:text-xs md:text-sm lg:text-lg font-bold tracking-wide">I already have a record</p>
								</button>

								<button 
									onClick={() => setStep("REGISTER_NEW_RESIDENT")}
									className="group relative flex flex-col items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem] lg:rounded-[3rem] p-4 sm:p-6 md:p-8 lg:p-16 shadow-2xl transition-all hover:scale-105 active:scale-95 border-2 border-white/20 overflow-hidden"
								>
									<div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-5 transition-opacity" />
									<div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity blur-2xl" />
									<UserPlus className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-32 lg:h-32 text-white mb-2 md:mb-4 lg:mb-8 drop-shadow-2xl group-hover:scale-110 transition-transform duration-500" />
									<h2 className="text-lg sm:text-xl md:text-2xl lg:text-4xl font-black text-white drop-shadow-md whitespace-nowrap">New Resident</h2>
									<p className="text-neutral-300 mt-1 md:mt-2 text-[10px] sm:text-xs md:text-sm lg:text-lg font-bold tracking-wide">I need to register</p>
								</button>
							</div>
						</div>
					</div>
				)}

				{/* 2A. IDENTIFY: SCAN */}
				{step === "IDENTIFY_SCAN" && (
					<div className="w-full max-w-2xl flex flex-col items-center animate-in fade-in slide-in-from-right-8 duration-500">
						<div className="bg-neutral-900/60 backdrop-blur-2xl border border-white/10 p-12 rounded-[3rem] w-full shadow-2xl text-center">
							<ScanBarcode className="w-24 h-24 text-emerald-400 mx-auto mb-8 animate-pulse" />
							<h2 className="text-4xl font-extrabold text-white mb-4">Scan your ID</h2>
							<p className="text-lg text-neutral-400 mb-10">Place your barcode under the scanner.</p>
							
							<form onSubmit={handleScanLogin} className="max-w-xs mx-auto space-y-6">
								<div className="space-y-2 text-left relative">
									<Input 
										autoFocus
										aria-invalid={!!error}
										placeholder="Or type code..." 
										className="h-14 bg-neutral-950/50 text-center text-lg tracking-[0.3em] font-mono rounded-2xl transition-all shadow-inner placeholder:normal-case placeholder:tracking-normal border-neutral-800/80 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/50 aria-invalid:border-red-500 aria-invalid:ring-red-500/50"
										value={barcode}
										onChange={(e) => { setBarcode(e.target.value.toUpperCase()); setError(null); }}
									/>
									{error && <p className="text-red-400 text-sm font-medium animate-in fade-in text-center">{error}</p>}
								</div>
								<Button type="submit" disabled={loading || !barcode} className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-2xl shadow-xl shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100">
									{loading ? <Loader2 size={32} className="animate-spin" /> : "Continue"}
								</Button>
							</form>
						</div>

						<div className="flex flex-col sm:flex-row items-center gap-4 mt-8">
							<Button 
								variant="ghost" 
								onClick={handleReset}
								className="text-neutral-400 hover:text-white text-lg font-medium h-14 px-8 rounded-full bg-neutral-900/50 hover:bg-neutral-800 border border-white/5 transition-all"
							>
								<Home className="w-5 h-5 mr-3" /> Start Over
							</Button>
							<Button 
								variant="ghost" 
								onClick={() => { setStep("IDENTIFY_SEARCH"); setError(null); }}
								className="text-neutral-400 hover:text-white text-lg font-medium h-14 px-8 rounded-full bg-neutral-900/50 hover:bg-neutral-800 border border-white/5 transition-all"
							>
								<Search className="w-5 h-5 mr-3" /> No ID? Search Manually
							</Button>
						</div>
					</div>
				)}

				{/* 2B. IDENTIFY: SEARCH */}
				{step === "IDENTIFY_SEARCH" && (
					<div className="w-full max-w-2xl flex flex-col items-center animate-in fade-in slide-in-from-left-8 duration-500">
						<div className="bg-neutral-900/60 backdrop-blur-2xl border border-white/10 p-10 md:p-12 rounded-[3rem] w-full shadow-2xl">
							<div className="flex items-center justify-between mb-8">
								<div>
									<h2 className="text-4xl font-extrabold text-white mb-2">Search Records</h2>
									<p className="text-neutral-400">Enter your exact details to find your record.</p>
								</div>
								<div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
									<Search className="w-8 h-8 text-emerald-400" />
								</div>
							</div>
							
							<form onSubmit={handleSearchLogin} className="space-y-6 text-left">
								{error && <p className="text-red-400 text-sm font-medium animate-in fade-in text-center">{error}</p>}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div className="space-y-2">
										<Label className="text-neutral-400">First Name</Label>
										<div className="relative">
											<User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
											<Input 
												autoFocus
												aria-invalid={!!error}
												className="h-14 bg-neutral-950/50 text-lg rounded-xl border-neutral-800/80 pl-12 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/50 aria-invalid:border-red-500 aria-invalid:ring-red-500/50" 
												value={firstName}
												onChange={(e) => { setFirstName(e.target.value); setError(null); }}
											/>
										</div>
									</div>
									<div className="space-y-2">
										<Label className="text-neutral-400">Last Name</Label>
										<div className="relative">
											<User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
											<Input 
												aria-invalid={!!error}
												className="h-14 bg-neutral-950/50 text-lg rounded-xl border-neutral-800/80 pl-12 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/50 aria-invalid:border-red-500 aria-invalid:ring-red-500/50" 
												value={lastName}
												onChange={(e) => { setLastName(e.target.value); setError(null); }}
											/>
										</div>
									</div>
								</div>
								<div className="space-y-2 flex flex-col">
									<Label className="text-neutral-400">Date of Birth</Label>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												className={cn(
													"justify-start text-left font-normal bg-neutral-950/50 h-14 text-lg rounded-xl transition-all border",
													error ? 'border-red-500 bg-red-500/10 text-red-100 hover:bg-red-500/20' : 'border-neutral-800/80 hover:bg-neutral-900',
													!birthDate && "text-neutral-500"
												)}
											>
												<CalendarIcon className="mr-3 h-5 w-5 opacity-50" />
												{birthDate ? (
													format(parseISO(birthDate), "MMMM d, yyyy")
												) : (
													<span>Pick a date</span>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800 text-neutral-200" align="start">
											<CalendarComponent
												mode="single"
												selected={birthDate ? parseISO(birthDate) : undefined}
												defaultMonth={birthDate ? parseISO(birthDate) : undefined}
												captionLayout="dropdown"
												startMonth={new Date(1900, 0)}
												endMonth={new Date()}
												onSelect={(date) => {
													if (date) {
														setBirthDate(format(date, "yyyy-MM-dd"));
														setError(null);
													}
												}}
											/>
										</PopoverContent>
									</Popover>
								</div>
								<Button type="submit" disabled={loading || !firstName || !lastName || !birthDate} className="w-full h-14 mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-2xl shadow-xl shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100">
									{loading ? <Loader2 size={32} className="animate-spin" /> : "Search"}
								</Button>
							</form>
						</div>
						
						<Button 
							variant="ghost" 
							onClick={() => { setStep("IDENTIFY_SCAN"); setError(null); }}
							className="mt-8 text-neutral-400 hover:text-white text-lg font-medium h-14 px-8 rounded-full bg-neutral-900/50 hover:bg-neutral-800 border border-white/5 transition-all"
						>
							<ArrowLeft className="w-5 h-5 mr-3" /> Back to Scanner
						</Button>
					</div>
				)}

				{/* 2C. IDENTIFY: NEW REGISTRATION */}
				{step === "REGISTER_NEW_RESIDENT" && (
					<div className="w-full max-w-3xl flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-500">
						<div className="bg-neutral-900/60 backdrop-blur-2xl border border-white/10 p-10 md:p-12 rounded-[3rem] w-full shadow-2xl text-center relative overflow-hidden">
							
							<div className="mb-8">
								<div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20 mx-auto mb-4">
									<UserPlus className="w-10 h-10 text-emerald-400" />
								</div>
								<h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2">New Resident</h2>
								<p className="text-neutral-400">Fill in your basic details to get started.</p>
							</div>
							
							<form onSubmit={handleRegisterNewResident} className="space-y-6 text-left">
								{error && (
									<div className="flex flex-col items-center justify-center animate-in fade-in text-center mb-4">
										<p className="text-red-400 text-sm font-medium">{error}</p>
										{error.includes("already exists") && (
											<Button 
												type="button"
												variant="ghost" 
												onClick={() => { setStep("IDENTIFY_SEARCH"); setError(null); }}
												className="mt-3 text-neutral-400 bg-neutral-900 border border-neutral-800 hover:text-white hover:bg-neutral-800 rounded-full h-10 px-6 text-sm font-medium transition-all"
											>
												Go to Login Screen
											</Button>
										)}
									</div>
								)}
								
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div className="space-y-2">
										<Label className="text-neutral-400">First Name <span className="text-red-500">*</span></Label>
										<div className="relative">
											<User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
											<Input 
												autoFocus
												aria-invalid={!!error && !regFirstName}
												className="h-14 bg-neutral-950/50 text-lg rounded-xl border-neutral-800/80 pl-12 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/50 aria-invalid:border-red-500 aria-invalid:ring-red-500/50" 
												value={regFirstName}
												onChange={(e) => { setRegFirstName(e.target.value); setError(null); }}
												placeholder="e.g. Juan"
											/>
										</div>
									</div>
									<div className="space-y-2">
										<Label className="text-neutral-400">Last Name <span className="text-red-500">*</span></Label>
										<div className="relative">
											<User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
											<Input 
												aria-invalid={!!error && !regLastName}
												className="h-14 bg-neutral-950/50 text-lg rounded-xl border-neutral-800/80 pl-12 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/50 aria-invalid:border-red-500 aria-invalid:ring-red-500/50" 
												value={regLastName}
												onChange={(e) => { setRegLastName(e.target.value); setError(null); }}
												placeholder="e.g. Dela Cruz"
											/>
										</div>
									</div>
								</div>
								
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div className="space-y-2 flex flex-col">
										<Label className="text-neutral-400">Date of Birth <span className="text-red-500">*</span></Label>
										<Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
											<PopoverTrigger asChild>
												<div className="relative">
													<CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 z-10 pointer-events-none" />
													<Button
														type="button"
														variant="outline"
														className={cn(
															"w-full justify-start text-left font-normal bg-neutral-950/50 h-14 text-lg rounded-xl transition-all border pl-12",
															(error && !regBirthDate) ? 'border-red-500 bg-red-500/10' : 'border-neutral-800/80 hover:bg-neutral-900',
															!regBirthDate && "text-neutral-500"
														)}
													>
														{regBirthDate ? (
															format(parseISO(regBirthDate), "MMMM d, yyyy")
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</div>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800 text-neutral-200" align="start">
												<CalendarComponent
													mode="single"
													selected={regBirthDate ? parseISO(regBirthDate) : undefined}
													defaultMonth={regBirthDate ? parseISO(regBirthDate) : undefined}
													captionLayout="dropdown"
													startMonth={new Date(1900, 0)}
													endMonth={new Date()}
													onSelect={(date) => {
														if (date) {
															setRegBirthDate(format(date, "yyyy-MM-dd"));
															setIsDatePopoverOpen(false);
															setError(null);
														}
													}}
												/>
											</PopoverContent>
										</Popover>
									</div>
									<div className="space-y-2">
										<Label className="text-neutral-400">Gender <span className="text-red-500">*</span></Label>
										<div className="relative">
											<Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 z-10 pointer-events-none" />
											<Select value={regGender} onValueChange={(v) => { setRegGender(v); setError(null); }}>
												<SelectTrigger className={cn("w-full h-14 bg-neutral-950/50 text-lg rounded-xl border-neutral-800/80 pl-12 focus:ring-emerald-500/50", (error && !regGender) && "border-red-500")}>
													<SelectValue placeholder="Select gender" />
												</SelectTrigger>
												<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
													<SelectItem value="Male">Male</SelectItem>
													<SelectItem value="Female">Female</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div className="space-y-2">
										<Label className="text-neutral-400">Purok <span className="text-red-500">*</span></Label>
										<div className="relative">
											<MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 z-10 pointer-events-none" />
											<Select value={regPurok} onValueChange={(v) => { setRegPurok(v); setError(null); }}>
												<SelectTrigger className={cn("w-full h-14 bg-neutral-950/50 text-lg rounded-xl border-neutral-800/80 pl-12 focus:ring-emerald-500/50", (error && !regPurok) && "border-red-500")}>
													<SelectValue placeholder="Select Purok" />
												</SelectTrigger>
												<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200 max-h-[250px]">
													{purokOptions.map((p) => (
														<SelectItem key={p} value={p}>{p}</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
									<div className="space-y-2">
										<Label className="text-neutral-400">Contact Number</Label>
										<div className="relative">
											<Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 z-10 pointer-events-none" />
											<Input 
												type="tel"
												className="h-14 bg-neutral-950/50 text-lg rounded-xl border-neutral-800/80 pl-12 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/50" 
												value={regContactNumber}
												onChange={(e) => setRegContactNumber(e.target.value)}
												placeholder="Optional"
											/>
										</div>
									</div>
								</div>

								<Button type="submit" disabled={loading || !regFirstName || !regLastName || !regBirthDate || !regGender || !regPurok} className="w-full h-16 mt-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-bold rounded-2xl shadow-xl shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100">
									{loading ? <Loader2 size={32} className="animate-spin" /> : "Complete Registration & Continue"}
								</Button>
							</form>
						</div>
						
						<Button 
							variant="ghost" 
							onClick={handleReset}
							className="mt-8 text-neutral-400 hover:text-white text-lg font-medium h-14 px-8 rounded-full bg-neutral-900/50 hover:bg-neutral-800 border border-white/5 transition-all"
						>
							<Home className="w-5 h-5 mr-3" /> Start Over
						</Button>
					</div>
				)}

				{/* 3. SELECT DOCUMENTS (Full Width Grid) */}
				{step === "SELECT_DOCUMENTS" && activeResident && (
					<div className="w-full h-full flex flex-col animate-in fade-in zoom-in-95 duration-500 pt-4 pb-8 max-w-5xl mx-auto">
						
						<div className="flex-1 flex flex-col min-h-0 bg-neutral-900/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
							{/* Header */}
							<div className="p-8 border-b border-white/5 bg-neutral-950/30 flex justify-between items-center">
								<div>
									<h2 className="text-3xl font-extrabold text-white">Select Documents</h2>
									<p className="text-neutral-400 mt-1">Tap the documents you want to request.</p>
								</div>
								<Button 
									variant="ghost" 
									onClick={handleReset}
									className="text-neutral-400 hover:text-white"
								>
									<X className="w-6 h-6" />
								</Button>
							</div>
							
							{/* Scrollable Grid */}
							<div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
								<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 pb-24">
									{templates.map(tpl => {
										const isInCart = cart.some(item => item.id === tpl.id);
										return (
											<div 
												key={tpl.id}
												onClick={() => {
													if (isInCart) {
														setCart(cart.filter(i => i.id !== tpl.id));
													} else {
														setCart([...cart, tpl]);
													}
												}}
												className={`group relative border-2 rounded-3xl p-5 cursor-pointer transition-all flex flex-col overflow-hidden h-full ${isInCart ? 'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-900/20 scale-[0.98]' : 'border-neutral-800/80 bg-neutral-950/50 hover:border-emerald-500/50 hover:bg-neutral-900/80 hover:-translate-y-1'}`}
											>
												{isInCart && (
													<div className="absolute top-4 right-4 z-20 text-emerald-400 bg-neutral-950 rounded-full">
														<CheckCircle2 className="w-6 h-6" />
													</div>
												)}
												
												{/* Image Area */}
												<div className="w-full h-32 relative flex items-center justify-center mb-4">
													{tpl.imageBase64 ? (
														<img 
															src={tpl.imageBase64.startsWith('data:image') ? tpl.imageBase64 : `/templates/${tpl.imageBase64}`}
															alt={tpl.name}
															className="max-w-full max-h-full object-contain filter drop-shadow-md"
														/>
													) : (
														<FileText className={`w-12 h-12 transition-colors duration-300 ${isInCart ? 'text-emerald-400' : 'text-neutral-600 group-hover:text-emerald-500'}`} />
													)}
												</div>

												{/* Content Area */}
												<div className="flex flex-col flex-1 justify-end text-center">
													<div className="font-bold text-base text-white leading-tight mb-1">{tpl.name}</div>
													<div className="text-emerald-400 font-black">₱{tpl.price?.toFixed(2) || "0.00"}</div>
												</div>
											</div>
										);
									})}
								</div>
								{templates.length === 0 && (
									<div className="flex flex-col items-center justify-center h-full text-neutral-500 space-y-4 pt-10">
										<FileText className="w-16 h-16 opacity-20" />
										<p className="text-lg">No documents available.</p>
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Floating Bottom Action Bar (Truly fixed to viewport) */}
				{step === "SELECT_DOCUMENTS" && activeResident && (
					<div className={`fixed bottom-10 left-1/2 -translate-x-1/2 pointer-events-none z-[100] flex justify-center w-full max-w-sm px-4 transition-all duration-500 ${cart.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
						<div className="pointer-events-auto w-full">
							<Button 
								onClick={() => setStep("CHECKOUT")} 
								className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-bold rounded-[2rem] shadow-[0_10px_50px_-10px_rgba(16,185,129,0.7)] border border-emerald-400/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-between px-8"
							>
								<span>Review Request</span>
								<div className="flex items-center gap-3">
									<span className="bg-emerald-800/50 text-emerald-100 px-3 py-1 rounded-full text-sm">
										{cart.length} item{cart.length !== 1 && 's'}
									</span>
									<span>₱{cart.reduce((total, item) => total + (item.price || 0), 0).toFixed(2)}</span>
								</div>
							</Button>
						</div>
					</div>
				)}

				{/* 4. CHECKOUT (Review Summary) */}
				{step === "CHECKOUT" && activeResident && (
					<div className="w-full max-w-2xl flex flex-col items-center animate-in fade-in slide-in-from-right-8 duration-500 h-full py-4">
						<div className="w-full flex flex-col min-h-0 bg-neutral-900/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
							{/* Header with Back Button */}
							<div className="p-8 border-b border-white/5 bg-neutral-950/50 flex items-center gap-4">
								<Button 
									variant="ghost" 
									onClick={() => setStep("SELECT_DOCUMENTS")}
									className="text-neutral-400 hover:text-white mr-2"
								>
									<ArrowLeft className="w-6 h-6" />
								</Button>
								{activeResident.photoBase64 ? (
									<img src={activeResident.photoBase64} alt="Resident" className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/30" />
								) : (
									<div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center">
										<Search className="w-6 h-6 text-neutral-500" />
									</div>
								)}
								<div className="flex-1 min-w-0">
									<div className="font-bold text-white text-lg truncate">{activeResident.firstName} {activeResident.lastName}</div>
									<div className="text-emerald-400 text-sm font-medium truncate">{activeResident.purok}</div>
								</div>
							</div>

							{/* Cart Details */}
							<div className="flex-1 p-8 flex flex-col overflow-y-auto custom-scrollbar">
								<h3 className="font-bold text-neutral-400 text-sm mb-6 text-center">Your Request Summary</h3>
								
								{cart.length === 0 ? (
									<div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-50 pb-10">
										<div className="w-20 h-20 border-2 border-dashed border-neutral-600 rounded-3xl flex items-center justify-center">
											<FileText className="w-8 h-8 text-neutral-600" />
										</div>
										<p className="text-neutral-400 font-medium">No documents in cart.</p>
										<Button 
											variant="ghost"
											onClick={() => setStep("SELECT_DOCUMENTS")} 
											className="mt-6 text-neutral-400 hover:text-white text-base font-medium h-14 px-8 rounded-full bg-neutral-900/50 hover:bg-neutral-800 border border-white/5 transition-all"
										>
											Go back and select documents
										</Button>
									</div>
								) : (
									<div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4">
										<div className="space-y-4 mb-8 flex-1">
											{cart.map((item, index) => (
												<div key={`${item.id}-${index}`} className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 relative group flex items-center gap-4">
													{item.imageBase64 ? (
														<img src={item.imageBase64.startsWith('data:image') ? item.imageBase64 : `/templates/${item.imageBase64}`} alt="" className="w-12 h-12 object-contain bg-white/5 rounded-xl p-1.5" />
													) : (
														<div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center"><FileText className="w-6 h-6 text-neutral-600" /></div>
													)}
													<div className="flex-1 min-w-0 pr-10">
														<div className="font-bold text-white text-lg leading-tight truncate">{item.name}</div>
														<div className="font-black text-emerald-400 text-base mt-0.5">₱{item.price?.toFixed(2) || "0.00"}</div>
													</div>
													<button 
														type="button"
														onClick={() => setCart(cart.filter((_, i) => i !== index))}
														className="absolute top-1/2 -translate-y-1/2 right-4 w-10 h-10 bg-neutral-900 border border-neutral-700 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all shadow-md"
													>
														<X className="w-5 h-5" />
													</button>
												</div>
											))}
										</div>

										<div className="space-y-3 mt-auto shrink-0 pt-6">
											<Label className="text-neutral-300 font-bold text-lg">What is the purpose of this request?</Label>
											<Input 
												placeholder="e.g. Employment, School requirement, Business..." 
												className="h-16 bg-neutral-950/80 border-neutral-800 rounded-2xl px-6 text-lg focus:border-emerald-500 transition-all shadow-inner"
												value={purpose}
												onChange={e => setPurpose(e.target.value)}
											/>
										</div>
									</div>
								)}
							</div>

							{/* Cart Footer / Checkout */}
							<div className="p-6 bg-neutral-950/80 rounded-b-[2.5rem]">
								<div className="flex justify-between items-end mb-6">
									<div className="text-neutral-400 font-medium text-lg">Total Amount</div>
									<div className="text-3xl font-black text-white tracking-tight">
										₱{cart.reduce((total, item) => total + (item.price || 0), 0).toFixed(2)}
									</div>
								</div>
								
								<Button 
									onClick={handleSubmitRequest} 
									disabled={cart.length === 0 || !purpose || loading}
									className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-2xl shadow-xl shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
								>
									{loading ? <Loader2 size={32} className="animate-spin" /> : "Confirm Request"}
								</Button>
							</div>
						</div>
					</div>
				)}

				{/* 4. SUCCESS SCREEN */}
				{step === "SUCCESS" && (
					<div className="w-full max-w-xl flex flex-col items-center justify-center animate-in zoom-in-95 duration-700 h-full pb-24 mx-auto pt-0 -mt-2 md:-mt-4">
						
						{/* The Main "Receipt" Card with Speech Bubble Pointer */}
						<div className="bg-[#111111] border border-white/5 rounded-[2.5rem] p-8 md:p-10 pb-8 text-center shadow-2xl w-full relative flex flex-col items-center mt-4">
							
							{/* Speech Bubble Pointer (The little triangle pointing up) */}
							<div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-[#111111] rotate-45 border-t border-l border-white/5 rounded-tl-sm" />
							
							<h2 className="text-4xl md:text-5xl font-bold text-emerald-500 mb-6 mt-2 tracking-tight relative z-10">
								Request Submitted!
							</h2>
							
							<div className="text-neutral-400 font-bold mb-2 text-sm md:text-base">
								Your queue number is
							</div>
							
							<div className="text-7xl md:text-[7rem] font-black text-white tracking-tighter drop-shadow-md my-2">
								{queueNumber}
							</div>
							
							<div className="flex justify-center mt-4 mb-6 text-emerald-500">
								<div className="flex items-center gap-1">
									<User className="w-10 h-10" strokeWidth={2.5} />
									<User className="w-8 h-8 opacity-60 -ml-4" strokeWidth={2.5} />
								</div>
							</div>
							
							<div className="text-neutral-300 text-lg md:text-xl font-medium leading-relaxed max-w-sm mb-8">
								Please take a seat and wait for your queue number to be called.
							</div>
							
							<Button 
								onClick={handleReset}
								className="w-full h-14 bg-[#049B61] hover:bg-[#037a4c] text-white text-lg font-bold rounded-2xl shadow-xl shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
							>
								Start New Request
							</Button>
							
							<div className="mt-8 text-neutral-500 font-medium tracking-wide flex items-center justify-center gap-2 text-sm">
								<Loader2 className="w-4 h-4 animate-spin" />
								<span>Auto-closing in {countdown}s...</span>
							</div>
							
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

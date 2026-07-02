import Barcode from "react-barcode";

export function ResidentIdCard({ resident }: { resident: any }) {
	// The template has Front on the left, Back on the right.
	// We will create a fixed aspect ratio container that matches typical side-by-side IDs.
	// Assuming the image is roughly 3.375 x 2.125 inches per side -> 6.75 x 2.125 total.
	// In pixels, let's say 1012px by 318px (just a scalable container).
	
	const validUntil = new Date();
	validUntil.setFullYear(validUntil.getFullYear() + 1); // 1 year validity

	return (
		<div 
			id={`id-card-${resident.id}`}
			className="relative overflow-hidden bg-white text-black font-sans shrink-0 id-card-print-container"
			style={{ 
				width: "1012px", 
				height: "318px",
				backgroundImage: "url('/templates/id-template.png')",
				backgroundSize: "100% 100%",
				backgroundRepeat: "no-repeat"
			}}
		>
			{/* ---------------- FRONT (LEFT HALF) ---------------- */}

			{/* 1x1 Photo Box */}
			{resident.photoBase64 ? (
				<img 
					src={resident.photoBase64} 
					alt="Resident" 
					className="absolute object-cover"
					style={{ top: "35%", left: "4.5%", width: "16.5%", height: "45%" }} 
				/>
			) : null}

			{/* NAME */}
			<div 
				className="absolute font-bold text-center uppercase tracking-wide flex items-center justify-center"
				style={{ top: "35.5%", left: "16%", width: "34%", height: "9%", fontSize: "18px" }}
			>
				{resident.firstName} {resident.middleName && resident.middleName !== "-" ? resident.middleName.charAt(0) + "." : ""} {resident.lastName}
			</div>

			{/* BARCODE (Under ID NO.) */}
			<div 
				className="absolute flex flex-col items-center justify-start"
				style={{ top: "51%", left: "14%", width: "38%", height: "20%" }}
			>
				<Barcode 
					value={resident.residentId || "00000000"} 
					format="CODE128" 
					width={2} 
					height={20} 
					displayValue={false} 
					margin={0}
					background="transparent"
				/>
				<div style={{ fontSize: "16px", marginTop: "2px", fontWeight: "normal", letterSpacing: "2px" }}>
					{resident.residentId || "00000000"}
				</div>
			</div>

			{/* PUROK */}
			<div 
				className="absolute font-bold text-center flex items-center justify-center whitespace-nowrap"
				style={{ top: "74%", left: "18.8%", width: "9%", height: "6%", fontSize: "16px" }}
			>
				{resident.purok}
			</div>

			{/* ---------------- BACK (RIGHT HALF) ---------------- */}

			{/* VALID UNTIL */}
			<div 
				className="absolute font-bold uppercase tracking-wide text-center flex items-center justify-center"
				style={{ top: "7.5%", left: "72%", width: "26%", height: "6%", fontSize: "16px" }}
			>
				{validUntil.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
			</div>

			{/* DATE OF BIRTH */}
			<div 
				className="absolute font-bold text-center flex items-center justify-center"
				style={{ top: "20%", left: "72%", width: "26%", height: "6%", fontSize: "16px" }}
			>
				{resident.birthDate ? new Date(resident.birthDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : "—"}
			</div>
			
			{/* The rest of the emergency lines are left blank as requested */}
		</div>
	);
}
